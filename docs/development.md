# Developing in workshop-app

## Prerequisites

- Bun `>= 1.3.6`.
- Docker for image validation.
- PostgreSQL for migrations, seeds, and repository integration tests.
- `kubectl` for Kubernetes manifest rendering checks.

## Local workflow

Install dependencies:

```bash
bun install
```

Run the local server:

```bash
bun run dev
```

Run database setup when a local PostgreSQL instance is available:

```bash
bun run db:migrate
bun run db:seed
```

Validate the repository:

```bash
bun run lint
bun test
bun run build
kubectl kustomize k8s/overlays/stag >/tmp/workshop-app-stag.yaml
kubectl kustomize k8s/overlays/prod >/tmp/workshop-app-prod.yaml
docker build --tag workshop-app:local .
```

## What the commands do

- `bun run dev` starts the Bun application from `src/main.ts`.
- `bun run lint` runs ESLint.
- `bun test` executes the Bun test suite.
- `bun run build` compiles TypeScript into `dist/`.
- `bun run db:migrate` applies SQL migrations from the app repository.
- `bun run db:seed` applies seed data for local or controlled environments.
- `docker build ...` validates the production image contract.

## Runtime configuration

Use `.env.example` as the local reference. The app reads database settings from
`DATABASE_URL` first, then from `POSTGRES_HOST`, `POSTGRES_PORT`,
`POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`.

For JWT validation, set:

- `JWT_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`

For OpenTelemetry and Datadog, set:

- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `DD_SERVICE`
- `DD_ENV`
- `DD_VERSION`

## Branching and delivery expectations

- Build features from `feature/*` branches.
- Open Pull Requests into `stag` for normal integration.
- Promote to `prod` only from `stag`.
- Expect `pr-validation.yml` to run lint, test, build, Kubernetes rendering,
  and container validation.
- Expect `deploy.yml` to publish the image, apply manifests, run migrations,
  and wait for rollout.
- Expect `promotion-source.yml` and `drift-report.yml` to guard production
  promotions.

## Documentation rules

- Write all documentation in English.
- Keep docs faithful to the current repository state.
- Update docs when commands, endpoints, directories, or workflows change.
- Do not document planned behavior as implemented unless it exists here.
