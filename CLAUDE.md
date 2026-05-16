# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun install          # install dependencies
bun run dev          # start dev server (src/main.ts, port 3000)
bun run lint         # ESLint
bun test             # full test suite
bun run build        # compile TypeScript into dist/
bun run arch:check   # enforce clean-architecture layer rules
bun run db:migrate   # apply SQL migrations
bun run db:seed      # load seed data
```

Run a single test file:
```bash
bun test src/bootstrap/config.test.ts
```

Validate Kubernetes manifests:
```bash
kubectl kustomize k8s/overlays/stag >/tmp/workshop-app-stag.yaml
kubectl kustomize k8s/overlays/prod >/tmp/workshop-app-prod.yaml
```

Full pre-PR validation (matches CI):
```bash
bun run lint && bun test && bun run build && bun run arch:check
```

## Architecture

The codebase follows clean architecture with four enforced layers enforced by `scripts/architecture-gate.ts`:

```
presentation  →  application  →  domain
infrastructure               →  domain
```

Forbidden edges (e.g. `application → infrastructure`, `domain → *`) fail `bun run arch:check`. Known temporary violations are tracked as accepted dispositions in `scripts/architecture-gate.ts` with IDs like `ARCH-DISP-001`.

### Layer layout

- **`src/domain/`** — aggregates, value objects, repository interfaces, and domain errors for each bounded context (`person`, `vehicle`, `stock-item`, `service`, `service-task`, `work-order`).
- **`src/application/`** — one class per use case (e.g. `CreateWorkOrder`, `ApproveServiceTask`). Use cases depend only on domain interfaces.
- **`src/infrastructure/`** — Drizzle/PostgreSQL repository implementations, JWT adapter, notification adapters (Beeceptor and no-op), OpenTelemetry setup.
- **`src/presentation/`** — Hono route handlers. Each domain area has a `register*Routes` function. Auth middleware lives at `src/presentation/middleware/auth.ts`.
- **`src/bootstrap/`** — wires all layers together: `build-infrastructure.ts` instantiates repos, `build-use-cases.ts` instantiates use cases, `register-routes.ts` mounts them onto the Hono app.

### Authentication

`workshop-app` does not issue tokens. It validates JWTs emitted by `workshop-edge`:
- Algorithm: `HS256`, verified with `JWT_SECRET`
- Required claims: `sub`, `person_id`, `cpf`, `role`, `status`, `iss`, `aud`, `exp`, `iat`, `jti`
- Middleware rejects `status !== "active"` with 403

### Persistence

Drizzle ORM over PostgreSQL. Schema definitions live in `src/infrastructure/db/schema/`, migrations in `src/infrastructure/db/migrations/`. The app reads `DATABASE_URL` first, then individual `POSTGRES_*` vars. Tests use a separate database selected via `POSTGRES_DB_TEST` / `DATABASE_URL_TEST`.

### Observability

OpenTelemetry starts only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. All request logs are JSON with `x-request-id` correlation.

## Branching and delivery

- Feature work: `feature/*` → PR into `stag`
- Never open PRs directly to `prod`; promote only via `stag → prod` promotion PR using a merge commit (no squash/rebase)
- Always `git fetch origin --prune` and branch from `origin/stag` before starting work

## Scope

This repository owns HTTP behavior, domain/application logic, Drizzle schema/migrations, and Kubernetes manifests. It does not own API Gateway routes, Lambda implementations, EKS/VPC provisioning, or RDS provisioning.
