# RFC-001 — Escolha da AWS como Provedor de Nuvem

| Campo | Valor |
|---|---|
| **Número** | RFC-001 |
| **Status** | Aceito |
| **Data** | 2026-05-17 |
| **Repositório** | workshop-app |

---

## Contexto

O sistema `workshop` é um backend de oficina mecânica com múltiplas unidades operacionais. O serviço precisa de:

- **Alta disponibilidade:** ordens de serviço em andamento não podem ser interrompidas por falhas de infraestrutura.
- **Escalabilidade horizontal:** picos de demanda (abertura de OS no início do dia, aprovações de clientes) exigem capacidade elástica.
- **Banco de dados gerenciado:** o esquema relacional com transações ACID (WorkOrder, ServiceTask, StockItem) exige um PostgreSQL confiável com backup automatizado.
- **Integração com serverless:** a autenticação via CPF é implementada como Lambda (`auth-cpf`), o que exige suporte nativo de plataforma.
- **Pipeline de CI/CD:** o fluxo de deploy (`feature → stag → prod`) exige registry de imagens Docker, orquestração de containers e deploys controlados.

A equipe avaliou três provedores de nuvem antes de tomar a decisão.

---

## Proposta

Utilizar a **AWS (Amazon Web Services)** como provedor de nuvem exclusivo para o sistema `workshop`, com os seguintes serviços:

| Serviço AWS | Uso no sistema |
|---|---|
| **EKS (Elastic Kubernetes Service)** | Orquestração do `workshop-app` com namespaces `stag` e `prod` |
| **RDS (Relational Database Service)** | Instância PostgreSQL gerenciada (`workshop-db`) |
| **API Gateway** | Ponto de entrada público, roteamento e integração com Lambda |
| **Lambda** | Função `auth-cpf` para autenticação sem servidor |
| **ECR (Elastic Container Registry)** | Registry de imagens Docker para o `workshop-app` |

---

## Alternativas Consideradas

### GCP (Google Cloud Platform)

O GCP oferece o GKE (Google Kubernetes Engine), Cloud SQL para PostgreSQL e Cloud Functions para serverless. A maturidade do GKE é comparável ao EKS. Contudo, a equipe não tem expertise prévia em GCP, o que aumentaria o tempo de onboarding e o risco operacional. O ecosistema de ferramentas de CI/CD com GitHub Actions tem suporte mais maduro para AWS (ações oficiais da AWS no marketplace).

### Azure (Microsoft Azure)

O Azure oferece AKS (Azure Kubernetes Service), Azure Database for PostgreSQL e Azure Functions. A integração com GitHub Actions é sólida (Microsoft possui o GitHub). No entanto, a oferta de serviços de API Gateway do Azure tem uma curva de configuração maior em comparação ao AWS API Gateway para cenários de autenticação Lambda-backed. O custo de RDS equivalente (Azure Database for PostgreSQL Flexible Server) é comparável, mas o ecosistema de observabilidade (Datadog via OTLP) tem integração mais documentada no AWS.

---

## Trade-offs

| Critério | AWS | GCP | Azure |
|---|---|---|---|
| Maturidade do EKS/GKE/AKS | Alta | Alta | Média-Alta |
| Expertise da equipe | Alta | Baixa | Média |
| Integração Lambda + API Gateway | Nativa (AWS) | Requer adaptação | Requer adaptação |
| Custo base (EKS + RDS + Lambda) | Médio | Médio | Médio |
| Ecosistema CI/CD com GitHub Actions | Maduro | Maduro | Maduro |
| Integração Datadog (OTLP) | Documentada | Documentada | Documentada |
| Lock-in | Médio-Alto | Médio-Alto | Médio-Alto |

O principal trade-off é o lock-in com serviços proprietários da AWS (API Gateway com Lambda authorizer, ECR, IAM). No entanto, os componentes de aplicação (`workshop-app` como container Kubernetes, PostgreSQL via Drizzle ORM) são portáveis, reduzindo o impacto prático do lock-in.

---

## Decisão

A AWS é adotada como provedor de nuvem exclusivo para o sistema `workshop`. A decisão é baseada em:

1. **Expertise operacional da equipe** com AWS EKS, RDS e Lambda.
2. **Integração nativa** entre API Gateway e Lambda para o fluxo de autenticação `auth-cpf`.
3. **Serviços gerenciados maduros** (RDS PostgreSQL com Multi-AZ, EKS com managed node groups).
4. **ECR como registry privado** integrado ao pipeline de CI/CD via GitHub Actions com ações oficiais da AWS.

Esta decisão é registrada como RFC para documentar as alternativas avaliadas e justificar a escolha diante dos requisitos do Tech Challenge Fase 3 (FIAP SOAT).
