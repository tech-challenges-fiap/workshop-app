# Project Context

## Repository

`workshop-app` is the HTTP API and business logic service for the workshop domain. It is designated the **OS Service** (Ordem de Serviço) for Phase 4 of the FIAP Tech Challenge.

## Ownership

This repository owns: Hono/Bun application code, domain/application logic, Drizzle migrations, PostgreSQL repositories, Docker and Kubernetes application manifests.

This repository does not own: API Gateway routes, Lambda handlers, shared EKS/VPC infrastructure, or RDS provisioning.

## Phase 4: OS Service Boundary

`workshop-app` is the sole system of record for work-order data. Table ownership:

- **Primary data** (owned and mutable): `work_orders`, `work_order_status_history`
- **Read-model projections** (seeded or replicated; never written via OS Service business logic): `persons`, `vehicles`

Cross-service data-access prohibition (change id: `f4-os-service-boundary`):

- Billing Service and Execution Service MUST consume work-order state via events, published projections, or the `workshop-app` HTTP API — never via a direct SQL connection.
- `workshop-app` MUST NOT open a direct database connection to any schema or database owned by Billing Service or Execution Service.
- Any proposed change that introduces a `DATABASE_URL` or `POSTGRES_*` variable pointing to a Billing or Execution database MUST be rejected.

When proposing Phase 4 implementation changes, reference the `f4-os-service-boundary` spec to ensure scope stays within these boundaries. If a proposed task would expand or cross these boundaries, stop and raise the question to Hermes/Void before proceeding.

## OpenSpec Governance

OpenSpec is the canonical process for non-trivial changes. Product, architecture, contract, infrastructure, schema, workflow, and runtime behavior changes must start with an OpenSpec change under `openspec/changes/<change-id>/`.

Claude Code and other agents must not implement from informal intent alone. If a change is missing, ambiguous, or expands beyond the approved tasks, the agent must stop and raise the question to Hermes/Void.

## Primary Change Areas

src/, k8s/, Dockerfile, docs/, .ai/

## Validation Baseline

```bash
bun run lint && bun test && bun run build && bun run arch:check
```

## Branching Baseline

Work starts from updated `origin/stag`, opens PRs into `stag`, and never pushes directly to `stag` or `prod`. Production remains promotion-only through `stag -> prod`.
