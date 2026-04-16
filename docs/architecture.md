# workshop-app Architecture

## Role in the Split

`workshop-app` is the application core of the workshop platform. In the target
split, it absorbs the business and domain logic currently concentrated in
`14soat-group56`, while the other repositories handle edge delivery, platform
infrastructure, and database provisioning.

## Boundaries

This repository owns:

- HTTP application behavior exposed directly by the service
- Domain and application logic extracted from the monolith
- Request handling, validation, orchestration, and runtime packaging
- Application tests and service-level health behavior

This repository does not own:

- API Gateway and Lambda edge adapters
- infrastructure stacks such as EKS, VPC, or shared ingress
- database instance provisioning
- operational policy that belongs to platform or edge automation

## Current Implementation Surface

Today the repository contains a bootstrap service only:

- `src/app.ts` handles requests
- `src/server.ts` starts the Bun server
- `GET /health` is the only implemented endpoint
- `test/app.test.ts` verifies health and 404 behavior
- `Dockerfile` builds a runtime image from the compiled Bun output

## Dependencies and Interactions

- `workshop-edge` is expected to front external HTTP concerns and forward or translate requests toward the app layer over time.
- `workshop-db` is expected to provision the PostgreSQL infrastructure that the application will consume later.
- `workshop-platform` is expected to provide shared runtime infrastructure such as cluster, networking, and ingress capabilities.

## Current Scaffold vs Target State

Current scaffold:

- minimal Bun service
- no workshop domain entities yet
- no persistence, migrations, or external integrations yet

Target state derived from `14soat-group56`:

- main home for workshop domain/application behavior
- internal API surface used by edge and operational components
- business rules and transactional workflows extracted from the monolith in controlled increments

## Non-Goals

- Do not move API Gateway or Lambda-specific behavior into this repository.
- Do not describe monolith endpoints here as implemented unless they are added to this repo.
- Do not use this repo for database instance provisioning or cluster bootstrap.
