# workshop-app architecture

## Role

`workshop-app` is the application service. It owns HTTP behavior, request
validation, domain rules, application orchestration, persistence adapters,
schema evolution, and runtime packaging.

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
