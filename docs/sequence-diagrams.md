# Diagramas de Sequência — workshop-app

Este documento apresenta os principais fluxos de interação do sistema, incluindo autenticação via CPF e abertura de ordem de serviço.

---

## 1. Fluxo de Autenticação via CPF

O processo de autenticação é totalmente gerenciado pelo componente externo `workshop-edge` (API Gateway + Lambda `auth-cpf`). O `workshop-app` não emite tokens; apenas os valida.

```mermaid
sequenceDiagram
    actor Cliente
    participant APIGW as API Gateway<br/>(workshop-edge)
    participant Lambda as Lambda auth-cpf<br/>(workshop-edge)
    participant DB_Edge as Banco de Dados<br/>(tabela person)
    participant App as workshop-app

    Cliente->>APIGW: POST /auth/login { cpf }
    APIGW->>Lambda: invoca auth-cpf com { cpf }
    Lambda->>DB_Edge: SELECT * FROM person WHERE cpf = hash(cpf)
    DB_Edge-->>Lambda: registro person (id, status, role)

    alt person não encontrada ou status != "active"
        Lambda-->>APIGW: erro 401/403
        APIGW-->>Cliente: 401 Unauthorized ou 403 Forbidden
    else person encontrada e status = "active"
        Lambda->>Lambda: gera JWT HS256<br/>claims: sub, person_id, cpf (hash),<br/>role, status, iss=workshop-edge,<br/>aud=workshop-app, exp, iat, jti
        Lambda-->>APIGW: JWT assinado
        APIGW-->>Cliente: 200 OK { token: "eyJ..." }
    end

    Note over Cliente,App: Fluxo subsequente — uso do token em rotas protegidas

    Cliente->>APIGW: GET /work-orders<br/>Authorization: Bearer <JWT>
    APIGW->>App: GET /work-orders<br/>Authorization: Bearer <JWT>
    App->>App: adminAuthMiddleware:<br/>valida assinatura HS256 (JWT_SECRET)<br/>verifica iss=workshop-edge, aud=workshop-app<br/>verifica exp e iat<br/>verifica claims obrigatórios<br/>verifica status = "active"

    alt JWT inválido ou expirado
        App-->>APIGW: 401 Unauthorized
        APIGW-->>Cliente: 401 Unauthorized
    else status != "active" (blocked/inactive)
        App-->>APIGW: 403 Forbidden
        APIGW-->>Cliente: 403 Forbidden
    else JWT válido e status = "active"
        App->>App: armazena contexto autenticado<br/>(subject, personId, cpfHash, role, status, jti)
        App-->>APIGW: 200 OK { work orders... }
        APIGW-->>Cliente: 200 OK { work orders... }
    end
```

---

## 2. Fluxo de Abertura de Ordem de Serviço

Este diagrama descreve o fluxo completo para criação de uma nova Work Order por um usuário autenticado (atendente/admin).

```mermaid
sequenceDiagram
    actor Cliente as Cliente Autenticado<br/>(atendente/admin)
    participant APIGW as API Gateway<br/>(workshop-edge)
    participant App as workshop-app<br/>(Hono + Use Cases)
    participant Domain as Domínio<br/>(WorkOrder aggregate)
    participant DB as workshop-db<br/>(PostgreSQL via Drizzle)
    participant Notifier as Notificador<br/>(Beeceptor/no-op)

    Cliente->>APIGW: POST /work-orders<br/>Authorization: Bearer <JWT><br/>{ vehicleId, serviceTasks: [...] }
    APIGW->>App: POST /work-orders<br/>Authorization: Bearer <JWT><br/>{ vehicleId, serviceTasks: [...] }

    App->>App: adminAuthMiddleware:<br/>valida JWT — ver diagrama anterior
    App->>App: valida payload de entrada<br/>(vehicleId, lista de serviceTasks)

    App->>Domain: CreateWorkOrder.execute({ vehicleId, serviceTasks })
    Domain->>Domain: verifica invariantes:<br/>- vehicle existe<br/>- status inicial = RECEIVED<br/>- calcula estimativa total<br/>- gera publicToken + publicTokenExpiresAt
    Domain->>Domain: adiciona ServiceTasks<br/>status inicial = PENDING_APPROVAL
    Domain->>Domain: emite WorkOrderCreated

    App->>DB: BEGIN TRANSACTION
    App->>DB: INSERT INTO work_orders (...) RETURNING id
    DB-->>App: { workOrderId }
    App->>DB: INSERT INTO service_tasks (...) [para cada task]
    App->>DB: INSERT INTO work_order_status_history (RECEIVED, timestamp)
    App->>DB: COMMIT

    App->>Notifier: dispara notificação assíncrona<br/>(WorkOrderCreated → email/WhatsApp via Beeceptor)
    Notifier-->>App: aceito (não bloqueia resposta)

    App-->>APIGW: 201 Created<br/>{ id: <workOrderId>, status: "RECEIVED",<br/>publicToken: "...", totalAmount: "..." }
    APIGW-->>Cliente: 201 Created<br/>{ id: <workOrderId>, status: "RECEIVED",<br/>publicToken: "...", totalAmount: "..." }
```

---

## Notas

- **Responsabilidade do workshop-edge:** A Lambda `auth-cpf` e o API Gateway são mantidos pelo repositório `workshop-edge`. O `workshop-app` não tem visibilidade da implementação interna da Lambda.
- **Correlação de requests:** Todos os logs do `workshop-app` incluem `x-request-id`, `trace-id` e `span-id` para rastreabilidade. O header `x-request-id` é propagado ou gerado automaticamente pelo `requestLoggingMiddleware`.
- **Transações:** O Drizzle ORM garante atomicidade na criação da Work Order. Falha em qualquer etapa de persistência resulta em rollback completo.
- **Notificação assíncrona:** O adaptador de notificação não bloqueia a resposta HTTP. Falhas no notificador são logadas mas não afetam o resultado da operação de domínio.
- **Middleware de autorização:** `/stock-items/*`, `/services/*`, `/vehicles/*`, `/person/*` e `/work-orders/*` usam `adminAuthMiddleware`. `/service-tasks/*` usa `mechanicAuthMiddleware`.
