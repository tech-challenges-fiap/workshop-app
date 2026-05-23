# ADR-002 — Uso de HPA para Escalabilidade da Aplicação

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-05-17 |
| **Repositório** | workshop-app |

---

## Contexto

O `workshop-app` é implantado no EKS em dois namespaces (`stag` e `prod`). O tráfego da aplicação é variável:

- Picos de demanda no início do dia útil (abertura de ordens de serviço).
- Picos durante aprovações de clientes (concentrados em notificações enviadas).
- Baixa demanda em horários noturnos e fins de semana.

A equipe avaliou três estratégias de escalabilidade:

- **Nenhuma escalabilidade automática:** número fixo de réplicas. Simples, mas desperdiça recursos em horários de baixa demanda ou causa degradação em picos.
- **Escalabilidade vertical (VPA — Vertical Pod Autoscaler):** ajusta os requests/limits de CPU e memória dos pods existentes. Exige reinicialização dos pods para aplicar mudanças, causando indisponibilidade transitória. Adequado para cargas com padrão estável e previsível.
- **Escalabilidade horizontal (HPA — Horizontal Pod Autoscaler):** adiciona ou remove réplicas do Deployment com base em métricas. Não exige reinicialização; novos pods são provisionados enquanto os existentes continuam atendendo.

Os recursos do container `workshop-app` são:
- **Requests:** 100m CPU, 128Mi memória
- **Limits:** 500m CPU, 512Mi memória

---

## Decisão

Adotar o **HPA (Horizontal Pod Autoscaler)** com as seguintes configurações, conforme definido em `k8s/base/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: workshop-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: workshop-app
  minReplicas: 1
  maxReplicas: 3
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 75
```

| Parâmetro | Valor | Justificativa |
|---|---|---|
| `minReplicas` | 1 | Garante disponibilidade mínima sem custo de réplicas ociosas fora do horário de pico |
| `maxReplicas` | 3 | Limita custo máximo do cluster; suficiente para o volume esperado do MVP |
| CPU target | 70% | Margem de 30% antes de escalar; evita escaladas prematuras e garante headroom para picos instantâneos |
| Memória target | 75% | Complementar ao CPU; protege contra vazamentos de memória e pressão de GC |

O Deployment base configura `replicas: 2`, garantindo redundância desde o deploy inicial (sem depender de o HPA ter escalado).

---

## Consequências

### Positivas

- **Escalabilidade sem downtime:** novos pods são provisionados enquanto pods existentes continuam atendendo. O processo de Bun é stateless; novos pods entram em serviço assim que o probe `/ready` responde com 200.
- **Custo proporcional à demanda:** fora de horários de pico, o HPA pode reduzir para `minReplicas: 1`, reduzindo consumo de recursos do node group EKS.
- **Dois critérios de escala:** o uso conjunto de CPU e memória como métricas previne cenários onde um dos recursos satura sem acionar o outro (ex: workloads de I/O intensivo que não sobrecarregam CPU).
- **Configuração por namespace via Kustomize:** os overlays `stag` e `prod` herdam a configuração base do HPA, garantindo consistência entre ambientes.

### Negativas

- **Escala apenas horizontal, não vertical:** se uma única requisição for excepcionalmente pesada (ex: query complexa de relatório), o HPA não ajudará; o pod pode atingir o limit de 500m CPU sem acionar escala.
- **Latência de cold start:** um novo pod demora entre 10 e 20 segundos para se tornar `ready` (initialDelaySeconds do readinessProbe). Durante esse período, o tráfego é absorvido pelas réplicas existentes, que podem estar sob pressão.
- **Limite superior fixo:** `maxReplicas: 3` é suficiente para o MVP mas pode ser insuficiente para crescimento significativo de volume. Revisão periódica do limite máximo é necessária.
- **Dependência de metrics-server:** o HPA requer que o `metrics-server` esteja instalado e funcional no cluster EKS. Falha no metrics-server impede escalada automática.

### Neutras

- O VPA não é excluído para uso futuro em outros componentes (ex: jobs de migração). Para o Deployment principal do `workshop-app`, o HPA é a escolha adequada dada a natureza stateless da aplicação.
- A política de escala pode ser ajustada com `behavior.scaleDown.stabilizationWindowSeconds` para evitar oscilações rápidas (scale in/out frequente), mas não foi configurada no MVP para manter a configuração simples.
