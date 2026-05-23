# ADR-003 — Uso de API Gateway + Lambda para Autenticação (auth-cpf)

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-05-23 |
| **Repositório** | workshop-app (decisão transversal) |

---

## Contexto

O sistema `workshop` exige autenticação de usuários (atendentes, mecânicos, administradores) antes de acessar os endpoints do `workshop-app`. O fluxo de autenticação é baseado em CPF: o cliente envia o CPF, o sistema valida a existência na base de dados e retorna um JWT assinado.

A equipe avaliou três abordagens para implementar a autenticação:

- **Autenticação inline no workshop-app:** um endpoint `/auth/login` dentro do próprio serviço Kubernetes. Simples, mas acopla lógica de autenticação ao domínio de negócio e exige que o cluster esteja disponível para qualquer login.
- **Serviço de autenticação dedicado (microservice):** um container separado no EKS para autenticação. Adiciona complexidade operacional (deploy, scaling, health-check) sem ganho proporcional, dado que a lógica de autenticação é simples (consulta CPF + emissão JWT).
- **API Gateway + Lambda:** a autenticação é uma função serverless (`auth-cpf`) invocada pelo API Gateway. Escala independentemente do cluster, tem cold-start aceitável para login (operação pontual), e isola completamente a superfície de autenticação do domínio de negócio.

---

## Decisão

Adotar **AWS API Gateway (HTTP API)** como ponto de entrada público com uma **Lambda `auth-cpf`** para autenticação por CPF.

### Arquitetura

```
Cliente → API Gateway → Lambda auth-cpf → RDS PostgreSQL
                ↓ (rotas /api/*)
          API Gateway → EKS (workshop-app)
```

### Detalhes da implementação

- **Lambda `auth-cpf`:** recebe `POST /auth` com payload `{ "cpf": "..." }`, consulta a tabela `person` no RDS via Secrets Manager para credenciais, e retorna um JWT assinado com roles e expiração configurável.
- **API Gateway:** roteia `/auth` para a Lambda e `/api/*` para o cluster EKS via VPC Link ou NLB.
- **Secrets Manager:** armazena credenciais do banco (`db_secret_arn`) e chave JWT (`jwt_secret_arn`), acessados pela Lambda via IAM Role.
- **VPC attachment:** a Lambda opera dentro da VPC para acesso direto ao RDS nas subnets privadas.

### Configuração (workshop-edge/terraform)

A infraestrutura é provisionada pelo repositório `workshop-edge`, incluindo:
- IAM Role com policy de acesso a Secrets Manager
- Lambda function com runtime Node.js e environment variables para DB e JWT
- API Gateway HTTP API com rotas integradas

---

## Consequências

### Positivas

- **Isolamento:** a autenticação não depende da disponibilidade do EKS; se o cluster estiver em deploy ou scaling, logins continuam funcionando.
- **Escalabilidade independente:** Lambda escala automaticamente sem configuração de HPA.
- **Segurança:** a Lambda acessa o RDS em rede privada e obtém credenciais via Secrets Manager (nunca em variáveis de ambiente em plain text).
- **Custo otimizado:** login é uma operação esporádica; Lambda cobra por invocação, evitando containers ociosos.

### Negativas

- **Cold-start:** a primeira invocação após inatividade pode levar ~1-3s (mitigado com provisioned concurrency se necessário).
- **Complexidade de deploy:** requer empacotamento separado (ZIP artifact) e deploy via Terraform no repositório `workshop-edge`.
- **Dependência de Secrets Manager:** adiciona um serviço AWS ao caminho crítico do login.
