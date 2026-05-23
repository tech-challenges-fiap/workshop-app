# ADR-005 — Uso de RDS PostgreSQL como Banco de Dados

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-05-23 |
| **Repositório** | workshop-app (decisão transversal) |

---

## Contexto

O sistema `workshop` gerencia entidades com relacionamentos complexos (WorkOrder → ServiceTask → StockItem, Person → Vehicle) e exige consistência transacional forte — por exemplo, ao aprovar uma ordem de serviço, todas as ServiceTasks associadas devem ser atualizadas atomicamente.

A equipe avaliou três opções de banco de dados:

- **PostgreSQL autogerido (container no EKS):** controle total, mas exige operação manual de backups, failover, upgrades e monitoramento. Risco operacional alto para uma equipe pequena.
- **Amazon RDS PostgreSQL:** banco gerenciado com backup automático, failover, patching e monitoramento integrado. Custo previsível e operação simplificada.
- **Amazon DynamoDB:** banco NoSQL serverless com escalabilidade automática. Não suporta JOINs, transações multi-tabela complexas ou esquema relacional natural para o domínio de oficina mecânica.

A natureza **relacional** do domínio (entidades com foreign keys, queries com JOINs, transações ACID multi-tabela) elimina opções NoSQL como escolha primária.

---

## Decisão

Adotar **Amazon RDS PostgreSQL** como banco de dados do sistema `workshop`.

### Configuração (workshop-db/terraform)

| Parâmetro | Staging | Produção |
|---|---|---|
| Instance class | db.t4g.micro | db.t4g.micro |
| Allocated storage | 20 GB | 20 GB |
| Max allocated storage | 25 GB | 25 GB |
| Multi-AZ | Não | Não |
| Backup retention | 1 dia | 1 dia |
| Deletion protection | Não | Não |
| Engine version | PostgreSQL 16 | PostgreSQL 16 |

> **Nota:** A configuração acima é otimizada para o contexto do Tech Challenge (custo mínimo). Em produção real, `prod` teria Multi-AZ, backup retention ≥ 7 dias e deletion protection ativa.

### Acesso

- **workshop-app (EKS):** conecta via connection string com credenciais em Kubernetes Secret (sincronizado do Secrets Manager).
- **Lambda auth-cpf:** conecta via Secrets Manager ARN, com IAM Role autorizado.
- **Migrations:** executadas como Kubernetes Job no namespace target antes do deploy do app.

### ORM e migrations

O acesso ao banco é feito via **Drizzle ORM** com esquema definido em TypeScript (`src/infrastructure/database/schema/`). Migrations são geradas via `drizzle-kit` e aplicadas como Jobs Kubernetes.

---

## Consequências

### Positivas

- **Operação simplificada:** backups automáticos, patching gerenciado, monitoramento via CloudWatch.
- **Consistência ACID:** transações multi-tabela garantidas nativamente pelo PostgreSQL.
- **Modelo relacional natural:** o domínio de oficina (WorkOrder, ServiceTask, StockItem, Person, Vehicle) mapeia diretamente para tabelas com FKs e constraints.
- **Portabilidade:** PostgreSQL é open-source; a aplicação pode migrar para qualquer provedor com PostgreSQL compatível.
- **Escalabilidade vertical simples:** upgrade de instance class sem downtime significativo (Multi-AZ).

### Negativas

- **Custo fixo:** RDS cobra por instância mesmo com baixa utilização (mitigado com `db.t4g.micro` para o challenge).
- **Escalabilidade horizontal limitada:** read replicas são possíveis, mas writes são centralizados. Aceitável para o volume do challenge.
- **Dependência de rede:** EKS e Lambda precisam de conectividade à VPC onde o RDS reside. Configurado via security groups e subnets compartilhadas.
