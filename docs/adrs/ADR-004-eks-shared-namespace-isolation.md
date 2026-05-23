# ADR-004 — EKS Compartilhado com Isolamento por Namespace

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-05-23 |
| **Repositório** | workshop-app (decisão transversal) |

---

## Contexto

O sistema `workshop` precisa de dois ambientes de execução — **staging** (`stag`) e **production** (`prod`) — para suportar o pipeline de promoção (`feature → stag → prod`). A equipe avaliou três estratégias de separação:

- **Dois clusters EKS separados:** isolamento total entre ambientes. Duplica custos de control plane (~$0.10/h por cluster = ~$144/mês apenas de control plane), node groups e observabilidade. Adequado para cenários com requisitos regulatórios de segregação rígida.
- **Um cluster EKS com isolamento por namespace:** um único control plane com namespaces `stag` e `prod`. Isolamento lógico via RBAC, Network Policies e Resource Quotas. Reduz custo operacional e simplifica o gerenciamento.
- **Ambientes separados por conta AWS:** máxima segregação, mas introduz complexidade de cross-account networking, IAM e observabilidade centralizada.

O Tech Challenge FIAP Fase 3 não impõe requisitos regulatórios de segregação física. O objetivo é demonstrar boas práticas de deploy com custo controlado.

---

## Decisão

Adotar **um único cluster EKS** com **isolamento por namespace** (`stag` e `prod`).

### Implementação (workshop-platform/terraform)

```hcl
locals {
  namespaces = ["stag", "prod"]
}

resource "kubernetes_namespace_v1" "environment" {
  for_each = toset(local.namespaces)

  metadata {
    labels = {
      "app.kubernetes.io/managed-by" = "workshop-platform"
      "workshop.fiap.io/environment" = each.key
    }
    name = each.key
  }
}
```

### Mecanismos de isolamento

| Mecanismo | Propósito |
|---|---|
| **Namespaces** | Separação lógica de workloads `stag` e `prod` |
| **RBAC** | Service accounts diferentes por namespace; deploy de `stag` não acessa resources de `prod` |
| **Resource Quotas** | Limita CPU/memória por namespace para evitar que `stag` impacte `prod` |
| **Network Policies** | Impede comunicação cross-namespace (pods de `stag` não alcançam pods de `prod`) |
| **Labels** | `workshop.fiap.io/environment` para filtragem em observabilidade (Datadog) |

### Deploy pipeline

- PR merge em `main` → deploy automático no namespace `stag`
- Promoção explícita (PR de promoção) → deploy no namespace `prod`

---

## Consequências

### Positivas

- **Custo reduzido:** um único control plane EKS (~$72/mês) ao invés de dois.
- **Operação simplificada:** um único cluster para monitorar, atualizar e manter.
- **Pipeline fluido:** kubectl/Helm apontam para o mesmo cluster, mudando apenas o namespace target.
- **Observabilidade unificada:** Datadog Agent único coleta métricas de ambos os namespaces com tags de ambiente.

### Negativas

- **Blast radius compartilhado:** uma falha no control plane ou no node group afeta ambos os ambientes. Mitigado pelo managed node group com auto-recovery da AWS.
- **Complexidade de RBAC:** requer configuração cuidadosa de roles para evitar escalação de privilégios entre ambientes.
- **Noisy neighbor:** sem Resource Quotas bem configurados, `stag` pode consumir recursos de `prod`. Mitigado com quotas definidas por namespace.
