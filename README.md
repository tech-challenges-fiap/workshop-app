# workshop-app

Primary API for the `workshop` project.

## Purpose

This repository owns the main application, including business logic,
evolutionary schema changes, migrations, seeds, and API container deployment.

## Main stack

- Bun
- TypeScript
- Docker
- AWS

## Deployment strategy

- `feature/* -> stag`: Pull Request with lint, tests, build, and container image validation
- `stag -> prod`: promotion Pull Request into `production`
- pipeline-based deployment using AWS OIDC authentication

## Local documentation

- [docs/README.md](docs/README.md)
