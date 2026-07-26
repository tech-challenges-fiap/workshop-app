# Project Context

## Repository

`workshop-app` is the HTTP API and business logic service for the workshop domain.

## Ownership

This repository owns: Hono/Bun application code, domain/application logic, Drizzle migrations, PostgreSQL repositories, Docker and Kubernetes application manifests.

This repository does not own: API Gateway routes, Lambda handlers, shared EKS/VPC infrastructure, or RDS provisioning.

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
