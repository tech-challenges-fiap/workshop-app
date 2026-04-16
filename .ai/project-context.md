# workshop-app project context

## Purpose

`workshop-app` is the future application core of the workshop platform split.
It should become the home of the business and domain logic currently centered
in `14soat-group56`.

## Current State

- Bun HTTP service
- single `GET /health` endpoint
- tests for health and 404 behavior
- Docker image build contract

## Adjacent Repositories

- `workshop-edge`: edge adapters and external integration contracts
- `workshop-db`: PostgreSQL infrastructure provisioning
- `workshop-platform`: shared infrastructure and Kubernetes/platform baseline

## Important Workflow

- develop on `feature/*`
- merge into `stag`
- promote from `stag` to `prod`
- respect CI checks before proposing changes
