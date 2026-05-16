# workshop-app project context

## Purpose

`workshop-app` is the application service repository. It owns HTTP behavior,
application logic, tests, and runtime packaging.

## Current State

- Bun/Hono HTTP API with workshop domain routes
- PostgreSQL repositories, Drizzle schema, migrations, and seeds
- external JWT validation for tokens emitted by `workshop-edge`
- `GET /health` and `GET /ready` operational endpoints
- JSON request logs and OpenTelemetry bootstrap
- Docker image build contract and Kubernetes manifests for `stag` and `prod`

## Operating Constraint

- keep the repository self-contained
- document only behavior that exists here
- treat infrastructure and gateway concerns as out of scope unless they are added to this repository

## Important Workflow

- develop on `feature/*`
- merge into `stag`
- promote from `stag` to `prod`
- respect CI checks before proposing changes
