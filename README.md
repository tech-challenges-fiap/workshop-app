# workshop-app

[![prod/stag](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Ftech-challenges-fiap%2Fworkshop-app%2Fbadges%2Fbadges%2Fprod-stag-sync.json)](https://github.com/tech-challenges-fiap/workshop-app/compare/prod...stag)

> Cloud-native workshop management API — Bun/Hono on EKS with full observability via Datadog.

`workshop-app` is the main application repository for the `workshop` service.
It owns the HTTP API, domain and application logic, PostgreSQL schema
evolution, migrations, seeds, runtime packaging, and Kubernetes deployment
assets.

This repository does not own API Gateway, edge Lambdas, EKS provisioning, or
RDS provisioning.

## What this repository owns

`workshop-app` is the **OS Service** (Ordem de Serviço) for Phase 4 of the
FIAP Tech Challenge. Its primary domain is the work-order lifecycle.

- Bun-based Hono HTTP API.
- Work-order domain and application use cases (`work_orders`,
  `work_order_status_history` are primary data — sole system of record).
- Read-model projections for `persons` and `vehicles` needed by work-order
  response payloads (populated via seed or replication; never mutated by OS
  Service business logic).
- Drizzle schema, SQL migrations, seeds, and PostgreSQL repositories.
- External JWT validation for tokens issued by `workshop-edge`.
- JSON request logs, request correlation, and OpenTelemetry bootstrap.
- Docker image and Kubernetes manifests for `stag` and `prod`.

**Cross-service boundary**: `workshop-app` MUST NOT open a direct database
connection to Billing Service or Execution Service databases. Those services
consume work-order state via events or the `workshop-app` HTTP API.

## Runtime contract

The official authentication flow is:

```text
API Gateway -> Lambda auth-cpf -> JWT -> workshop-app
```

`workshop-app` validates the JWT signature with `JWT_SECRET`, requires
`JWT_ISSUER=workshop-edge`, requires `JWT_AUDIENCE=workshop-app`, checks token
expiration, and requires the claims `sub`, `person_id`, `cpf`, `role`,
`status`, `iss`, `aud`, `exp`, `iat`, and `jti`.

The app accepts protected requests only when `status` is `active`. It does not
log raw CPF values or bearer tokens.

## Local commands

```bash
bun install
bun run dev
bun run lint
bun test
bun run build
bun run smoke:deploy
bun run db:migrate
bun run db:seed
docker build --tag workshop-app:local .
```

Default local runtime:

- Application port: `3000`
- Health endpoint: `http://localhost:3000/health`
- Readiness endpoint: `http://localhost:3000/ready`

PostgreSQL configuration comes from `DATABASE_URL` or the `POSTGRES_*`
variables documented in `.env.example`.

RabbitMQ messaging is optional in the current Phase 4 foundation. Configure
`RABBITMQ_URL`, `RABBITMQ_EXCHANGE`, `RABBITMQ_WORK_ORDER_EVENTS_QUEUE`,
`RABBITMQ_SAGA_EVENTS_QUEUE`, and `RABBITMQ_CONSUMERS_ENABLED` when a broker is
available; leaving `RABBITMQ_URL` empty keeps local composition and unit tests
broker-free.

The OS-owned distributed-flow layer uses the local work-order saga plus the
existing event publisher boundary to emit request intents for Billing
authorization, Execution start, and distributed compensation. Inbound Billing
and Execution saga events are handled idempotently by `eventId` and preserve the
inbound `correlationId` on outbound intents. This repository does not claim a
live broker end-to-end deployment and does not access Billing or Execution
databases directly.

## Estratégia do Saga Pattern

`workshop-app` implementa o fluxo distribuído da Ordem de Serviço (OS) como um
**Saga orquestrada (central)**, e não como uma Saga coreografada. A decisão é
uma consequência direta de decisões arquiteturais já adotadas neste
repositório, não uma preferência genérica:

- **A OS Service já é a única dona do ciclo de vida da OS.** As tabelas
  `work_orders` e `work_order_status_history` têm o `workshop-app` como único
  escritor (ver "Data Ownership" em `docs/architecture.md`), e o repositório
  não pode abrir conexão direta com os bancos de Billing ou Execution. Como a
  máquina de estados da saga (`WorkOrderSaga`, em
  `src/domain/work-order/saga/work-order-saga.ts`) já vive dentro da OS
  Service, orquestrar as transições no mesmo lugar evita duplicar essa
  propriedade em múltiplos serviços via coreografia implícita.
- **Existe um único coordenador de transições e efeitos colaterais.**
  `OrchestrateWorkOrderSaga`
  (`src/application/work-order/orchestrate-work-order-saga.ts`) é o único
  ponto que aplica uma transição na saga, decide se um evento já foi
  processado (`hasProcessedEvent`/`recordProcessedEvent`, garantindo
  idempotência por `eventId`) e decide qual intent distribuído publicar em
  seguida (`resolveDistributedIntentEventName`: autorização de billing,
  execução ou compensação). Numa Saga coreografada, essa mesma decisão estaria
  espalhada entre Billing Service e Execution Service, cada um reagindo a
  eventos do outro sem um dono único da política de compensação.
- **Compensação centralizada e auditável.** Quando Billing rejeita a
  aprovação ou Execution falha, a saga transita para `COMPENSATING` e o motivo
  (`compensationReason`) é persistido antes de publicar
  `os.work-order.compensation-requested.v1`. Com orquestração, essa regra de
  "o que aciona compensação e quando" é testada em um único lugar
  (`orchestrate-work-order-saga.test.ts`,
  `work-order-distributed-flow.test.ts` e o cenário BDD em
  `features/work-order-happy-path.feature`), em vez de depender da composição
  correta de handlers espalhados por três repositórios.
- **Testabilidade sem broker.** Por ter um orquestrador central e explícito, o
  fluxo inteiro (OS aberta → orçamento aprovado → execução concluída →
  `COMPLETED`) pode ser exercitado de ponta a ponta com um publisher e um
  repositório em memória, sem depender de um RabbitMQ real subindo três
  serviços — o que seria necessário para testar uma coreografia completa.
- **Trade-off aceito.** A orquestração cria um acoplamento lógico da OS
  Service ao conhecimento da política de compensação entre os três domínios.
  Isso é aceitável porque a OS Service já é a dona do estado da Ordem de
  Serviço nesta fase (Fase 4); coreografia adicionaria complexidade
  distribuída (fluxos implícitos, difíceis de testar e de auditar) sem
  remover essa propriedade que já está centralizada.

## Delivery flow

- `feature/* -> stag`: Pull Request validated by lint, tests, build,
  Kubernetes manifest rendering, and Docker image build.
- `stag -> prod`: promotion Pull Request allowed only from `stag`.
- `push` to `stag` or `prod`: deployment workflow builds and pushes the image
  to ECR, applies Kubernetes manifests, runs the migration `Job`, and waits for
  the deployment rollout before smoke-checking `/health`, `/ready`, and
  protected `GET /work-orders`.
- `prod` Pull Requests: drift-report and promotion-source workflows enforce
  branch discipline.
- `Create Promotion PR`: manual workflow that opens the `stag` to `prod`
  promotion PR when one does not already exist.

The `Create Promotion PR` workflow requires the `PROMOTION_PR_TOKEN`
repository secret. Use a fine-grained GitHub token with access to this
repository and pull request read/write permission.

## Documentation

- [Docs index](docs/README.md) — central hub; start here
- [Architecture](docs/architecture.md)
- [Development](docs/development.md)
- [Component diagram](docs/component-diagram.md) — cloud topology (API Gateway, Lambda, EKS stag/prod, RDS, Datadog)
- [Sequence diagrams](docs/sequence-diagrams.md) — authentication and work-order creation flows
- [ER diagram](docs/er-diagram.md) — relational model and migration rationale
- [RFCs](docs/rfcs/) — RFC-001 (AWS choice), RFC-002 (authentication strategy)
- [ADRs](docs/adrs/) — ADR-001 (REST/Hono), ADR-002 (HPA autoscaling)
- [AI contributor instructions](AGENTS.md)
