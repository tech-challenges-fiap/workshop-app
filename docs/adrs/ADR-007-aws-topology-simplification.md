# ADR-007 — Simplificação Operacional da Topologia AWS

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-05-23 |
| **Repositório** | workshop-app (decisão transversal) |

---

## Contexto

O Tech Challenge FIAP Fase 3 exige uma arquitetura cloud funcional, mas o contexto é acadêmico: não há SLA de produção, o sistema não receberá tráfego real e o orçamento é limitado (créditos AWS Academy ou conta pessoal).

Uma topologia AWS de produção real incluiria:

- Multi-AZ para RDS e EKS node groups
- WAF na frente do API Gateway
- CloudFront como CDN
- VPN ou Direct Connect para acesso administrativo
- Múltiplas contas AWS (dev, staging, prod) com AWS Organizations
- KMS customer-managed keys para criptografia
- GuardDuty, Config Rules e Security Hub

Implementar todos estes componentes para um challenge acadêmico é **over-engineering** que:
- Aumenta custo sem benefício real (não há tráfego de produção)
- Aumenta complexidade de Terraform e tempo de provisionamento
- Dificulta demonstração e troubleshooting

---

## Decisão

Adotar uma **topologia AWS simplificada** otimizada para demonstrabilidade, custo mínimo e cobertura dos requisitos do challenge, mantendo as boas práticas arquiteturais em nível lógico.

### Simplificações adotadas

| Componente | Produção real | Challenge (adotado) | Justificativa |
|---|---|---|---|
| RDS Multi-AZ | Sim | Não | Custo duplicado sem benefício para demo |
| RDS instance class | db.r6g.large+ | db.t4g.micro | Suficiente para carga de demonstração |
| EKS clusters | 2 (stag + prod) | 1 compartilhado | Isolamento por namespace é adequado |
| EKS node group | Multi-AZ, 3+ nodes | Single-AZ, 1-2 nodes | Custo mínimo, HPA demonstra scaling |
| WAF | Sim | Não | Sem tráfego externo malicioso no challenge |
| CloudFront | Sim | Não | API-only, sem assets estáticos |
| Contas AWS separadas | Sim | Conta única | Simplifica IAM e networking |
| Deletion protection | Sim | Não | Permite tear-down rápido após avaliação |
| Backup retention | 7-30 dias | 1 dia | Suficiente para demonstração |

### O que foi mantido (boas práticas preservadas)

| Prática | Implementação |
|---|---|
| VPC com subnets privadas | RDS em subnet privada, EKS nodes em subnet pública/privada |
| Security groups restritivos | RDS acessível apenas pelo EKS e Lambda SGs |
| Secrets Manager | Credenciais do banco e JWT secret nunca em plain text |
| IAM least privilege | Lambda roles com acesso mínimo (apenas GetSecretValue) |
| Infrastructure as Code | 100% Terraform, sem configuração manual |
| Namespace isolation | RBAC e labels para separação stag/prod |
| Observabilidade | Datadog Agent com métricas, logs e traces |

---

## Consequências

### Positivas

- **Custo controlado:** topologia completa custa ~$50-80/mês ao invés de $300+ com Multi-AZ e WAF.
- **Provisionamento rápido:** `terraform apply` completa em ~15 min ao invés de 30-45 min.
- **Fácil demonstração:** menos componentes para explicar ao avaliador; foco na arquitetura lógica.
- **Tear-down simples:** `terraform destroy` sem bloqueios por deletion protection.

### Negativas

- **Não é production-ready:** a topologia não suporta workloads reais com SLA. Documentado explicitamente como limitação do challenge.
- **Single points of failure:** RDS single-AZ e EKS com poucos nodes não toleram falhas de AZ.
- **Sem proteção DDoS:** ausência de WAF e CloudFront. Aceitável pois o sistema não é exposto publicamente além da avaliação.
