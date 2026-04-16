# workshop-app Architecture

## Role

`workshop-app` is the application service. It owns HTTP behavior, application
logic, request handling, and runtime packaging.

## Boundaries

This repository owns:

- HTTP application behavior exposed directly by the service
- Domain and application logic
- Request handling, validation, orchestration, and runtime packaging
- Application tests and service-level health behavior

This repository does not own infrastructure provisioning, edge gateway
adapters, or shared runtime platform policy.

## Current Implementation Surface

Today the repository contains a bootstrap service only:

- `src/app.ts` handles requests
- `src/server.ts` starts the Bun server
- `GET /health` is the only implemented endpoint
- `test/app.test.ts` verifies health and 404 behavior
- `Dockerfile` builds a runtime image from the compiled Bun output

## Current Scaffold vs Target State

Current scaffold:

- minimal Bun service
- no workshop domain entities yet
- no persistence, migrations, or external integrations yet

Target state:

- main home for workshop domain and application behavior
- a broader internal API surface than the current bootstrap endpoint
- business rules and transactional workflows implemented directly in this service

## Non-Goals

- Do not move API Gateway or Lambda-specific behavior into this repository.
- Do not describe endpoints as implemented unless they exist in this repository.
- Do not use this repo for infrastructure provisioning.
