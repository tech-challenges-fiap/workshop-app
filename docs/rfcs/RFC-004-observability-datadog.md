# RFC-004 — Observabilidade com Datadog

| Campo | Valor |
|---|---|
| **Número** | RFC-004 |
| **Status** | Aceito |
| **Data** | 2026-05-23 |
| **Repositório** | workshop-app (decisão transversal) |

---

## Contexto

O sistema `workshop` opera em ambiente distribuído (EKS + Lambda + RDS) e precisa de observabilidade para:

- Detectar e diagnosticar erros em produção
- Monitorar performance e latência dos endpoints
- Acompanhar métricas de negócio (ordens de serviço criadas, tempo de resolução)
- Validar que deploys não introduzem regressões

A equipe avaliou três abordagens de observabilidade.

---

## Proposta

Adotar **Datadog** como plataforma unificada de observabilidade cobrindo os três pilares (métricas, logs e traces) para todos os componentes do sistema.

### Cobertura por componente

| Componente | Métricas | Logs | Traces (APM) |
|---|---|---|---|
| workshop-app (EKS) | ✅ Datadog Agent | ✅ stdout → Agent | ✅ dd-trace |
| workshop-edge (Lambda) | ✅ Datadog Forwarder | ✅ CloudWatch → Forwarder | ✅ datadog-lambda-js |
| workshop-db (RDS) | ✅ RDS Integration | ✅ CloudWatch Logs | N/A |
| workshop-platform (EKS infra) | ✅ Agent (node metrics) | ✅ kubelet logs | N/A |

### Instrumentação do workshop-app

```typescript
// src/main.ts - inicialização do tracer
import 'dd-trace/init';
```

O Datadog Agent é implantado como DaemonSet no cluster EKS (provisionado via Helm no `workshop-platform`), coletando:
- **Métricas:** CPU, memória, requests/s, latência p50/p95/p99 por rota
- **Logs:** structured JSON logs emitidos para stdout, coletados pelo Agent
- **Traces:** spans distribuídos via dd-trace com propagação automática de contexto

### Dashboard unificado

Um dashboard Datadog centraliza a visão operacional:
- Request rate e error rate por endpoint
- Latência por rota (p50, p95, p99)
- Contagem de WorkOrders criadas/aprovadas
- Health do cluster (nodes, pods, CPU)
- Status do RDS (connections, IOPS, replication lag)

### Alertas

| Alerta | Condição | Ação |
|---|---|---|
| High error rate | >5% de 5xx em 5 min | Notificação |
| High latency | p95 > 2s em 5 min | Notificação |
| Pod CrashLoopBackOff | Restart count > 3 | Notificação |
| RDS high connections | >80% do max | Notificação |

---

## Alternativas Consideradas

### Prometheus + Grafana (self-hosted)

Stack open-source de métricas com Prometheus como collector/storage e Grafana como visualização.

**Prós:** custo zero de licença, controle total, ecosistema Kubernetes nativo (ServiceMonitor, PodMonitor).
**Contras:** operação manual (storage, retention, HA), não inclui APM/traces nativamente (requer Jaeger/Tempo), não cobre Lambda sem adaptação significativa, complexidade de manutenção para equipe pequena.

### AWS CloudWatch + X-Ray

Stack nativa AWS com CloudWatch para métricas/logs e X-Ray para traces distribuídos.

**Prós:** integração zero-config com serviços AWS (RDS, Lambda, EKS), sem infraestrutura adicional.
**Contras:** dashboards limitados em comparação com Datadog/Grafana, X-Ray tem granularidade menor que dd-trace, custo por volume de logs pode ser alto, vendor lock-in total com AWS.

### OpenTelemetry + Grafana Cloud

OpenTelemetry como standard de instrumentação com Grafana Cloud como backend gerenciado.

**Prós:** vendor-neutral, standard CNCF, traces + metrics + logs unificados.
**Contras:** setup mais complexo (collector, exporters, configuração), Grafana Cloud tem custo por série temporal, ecosistema menos integrado que Datadog para Kubernetes.

---

## Trade-offs

| Critério | Datadog | Prometheus+Grafana | CloudWatch+X-Ray | OTel+Grafana Cloud |
|---|---|---|---|---|
| Setup time | Baixo (Agent + Helm) | Alto | Baixo | Médio |
| APM/Traces | Nativo | Requer Jaeger | X-Ray (limitado) | OTel Collector |
| Lambda support | Nativo (Extension) | Requer adapter | Nativo | Requer adapter |
| Custo (trial/free) | Free trial 14d | Gratuito | Pay-per-use | Free tier |
| Manutenção | Zero (SaaS) | Alta | Zero | Baixa |
| Qualidade de dashboards | Excelente | Excelente | Limitada | Excelente |

---

## Decisão

Adotar **Datadog** como plataforma unificada de observabilidade. A decisão é baseada em:

1. **Cobertura completa:** métricas, logs e traces em uma plataforma, incluindo suporte nativo a EKS e Lambda.
2. **Operação zero:** SaaS gerenciado, sem necessidade de operar Prometheus/Grafana/Jaeger.
3. **Time-to-value:** setup via Helm chart (Agent) e `dd-trace/init` na aplicação; operacional em minutos.
4. **Integração Kubernetes:** DaemonSet com autodiscovery, tags automáticas por pod/namespace/deployment.
5. **Trial gratuito:** suficiente para o período do Tech Challenge.

A instrumentação é implementada via:
- `dd-trace` no `workshop-app` (APM automático para Hono + Drizzle)
- Datadog Lambda Extension no `workshop-edge`
- Datadog Agent DaemonSet no EKS (métricas infra + logs)
- RDS Integration para métricas de banco
