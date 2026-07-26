# workshop-app architecture

## Role

`workshop-app` is the application service and the designated **OS Service**
(Ordem de Serviço) for Phase 4. It owns HTTP behavior, request validation,
domain rules, application orchestration, persistence adapters, schema evolution,
and runtime packaging.

### Phase 4: Table Ownership

| Table | Ownership | Notes |
|-------|-----------|-------|
| `work_orders` | Primary data | Sole system of record; no other service writes here |
| `work_order_status_history` | Primary data | Status transitions and lifecycle history owned by OS Service |
| `persons` | Read-model projection | Populated via seed/replication; never mutated by OS Service business logic |
| `vehicles` | Read-model projection | Populated via seed/replication; never mutated by OS Service business logic |

## Boundaries

This repository owns:

- HTTP API behavior exposed by the service.
- Domain and application logic for people, vehicles, stock items, services,
  service tasks, and work orders.
- Drizzle schema, SQL migrations, seeds, and PostgreSQL repositories.
- JWT validation and route-level authorization.
- Application logs, request correlation, and OpenTelemetry startup.
- Docker and Kubernetes assets for application deployment.

This repository does not own:

- API Gateway routes.
- Lambda implementation.
- EKS, VPC, ingress controller, or Datadog agent provisioning.
- RDS instance provisioning or database infrastructure lifecycle.

## Data Ownership

`workshop-app` is the sole writer of `work_orders` and
`work_order_status_history`. Other services (Billing Service, Execution Service)
consume work-order state via events, published projections, or authorized HTTP
calls to `workshop-app` — never via a direct SQL connection to the
`workshop-app` database.

`workshop-app` MUST NOT open a direct database connection to any schema or
database instance owned by Billing Service or Execution Service. If an
implementation task requires data from those services, the developer must request
an inter-service API or event feed — not a shared connection string or
cross-schema query. A pull request introducing a `DATABASE_URL` or `POSTGRES_*`
variable pointing to a Billing or Execution database MUST be rejected.

## Messaging

The OS Service defines a RabbitMQ event foundation for Phase 4. OS-owned
work-order event envelopes use versioned event names, `eventId` for idempotency,
and `correlationId` for traceability. The configured exchange defaults to
`workshop.os.events`; queue names default to `workshop.os.work-order-events` for
OS-published lifecycle facts and `workshop.os.saga-events` for inbound saga
events. A live broker is optional for application composition and unit tests.

Inbound saga events are parsed and handed to the local work-order saga
orchestrator. Duplicate `eventId` values are handled by the OS-owned saga
idempotency store.

The distributed-flow orchestration layer emits OS-owned outbound request intents
through the existing publisher boundary:

- `os.work-order.billing-authorization-requested.v1` when a distributed saga is
  started with a correlation id.
- `os.work-order.execution-requested.v1` when a non-duplicate Billing approval
  event is accepted.
- `os.work-order.compensation-requested.v1` when a non-duplicate Billing
  rejection or Execution failure moves the saga to compensation.

These flows preserve inbound correlation ids and idempotency keys, but they are
tested with broker-free publisher/handler boundaries. The OS Service still does
not introduce direct database access to Billing or Execution services.

## Authentication

The app consumes JWTs emitted by `workshop-edge`. It no longer exposes
`/auth/login` from the composed application.

Protected routes validate:

- `HS256` signature with `JWT_SECRET`.
- `iss` against `JWT_ISSUER`, defaulting to `workshop-edge`.
- `aud` against `JWT_AUDIENCE`, defaulting to `workshop-app`.
- expiration and issued-at timestamps.
- required claims: `sub`, `person_id`, `cpf`, `role`, `status`, and `jti`.

The middleware rejects inactive or blocked subjects with `403`. It stores an
authenticated context with `subject`, `personId`, `cpfHash`, `role`, `status`,
and `jti` for downstream handlers.

## Persistence

The app owns schema evolution. Migrations remain under
`src/infrastructure/db/migrations`, and seeds remain under
`src/infrastructure/db/seeds`.

The `person` table includes `status` with the values `active`, `inactive`, and
`blocked`. The `work_order_status_history` table records status transitions so
the app can calculate average time per work-order status.

## Observability

The app emits JSON request logs with service, environment, request ID, trace
ID, span ID, route, method, status code, and duration fields. It propagates or
generates `x-request-id` for correlation.

OpenTelemetry starts only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. Datadog
receives telemetry through OTLP-compatible configuration.

## Deployment

The Docker image starts only the compiled application. Database migrations run
as a Kubernetes `Job` before rollout validation in the deploy workflow.

Kubernetes manifests live under `k8s/`:

- `k8s/base`: shared deployment, service, HPA, and config.
- `k8s/base-migrations`: shared migration job resources.
- `k8s/overlays/stag`: namespace and environment values for staging.
- `k8s/overlays/prod`: namespace and environment values for production.
