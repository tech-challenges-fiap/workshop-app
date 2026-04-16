# workshop-app project context

## Purpose

`workshop-app` is the application service repository. It owns HTTP behavior,
application logic, tests, and runtime packaging.

## Current State

- Bun HTTP service
- single `GET /health` endpoint
- tests for health and 404 behavior
- Docker image build contract

## Operating Constraint

- keep the repository self-contained
- document only behavior that exists here
- treat infrastructure and gateway concerns as out of scope unless they are added to this repository

## Important Workflow

- develop on `feature/*`
- merge into `stag`
- promote from `stag` to `prod`
- respect CI checks before proposing changes
