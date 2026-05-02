# workshop-app

`workshop-app` is the main application repository for the `workshop` service.
It owns HTTP service behavior, application logic, runtime packaging, and
application-focused validation.

## What This Repository Owns

- The Bun-based HTTP application
- Application and domain logic
- Runtime entrypoints and container packaging
- Application-level tests and local validation scripts

This repository does not own API Gateway concerns, edge Lambdas, or database
infrastructure provisioning.

## Current Scaffold Status

The current scaffold is intentionally small. Today it provides:

- a Bun HTTP server in `src/server.ts`
- a minimal request handler in `src/app.ts`
- a `GET /health` endpoint returning service status metadata
- Bun-based lint, test, and build scripts
- a production-oriented Dockerfile used by CI container validation

That means the repository is ready for incremental feature work, but it still
exposes only a minimal bootstrap service today.

## Local Commands

```bash
bun install
bun run dev
bun run lint
bun test
bun run build
docker build --tag workshop-app:local .
```

Default local runtime:

- Application port: `3000`
- Health endpoint: `http://localhost:3000/health`

## Delivery Flow

- `feature/* -> stag`: Pull Request validated by lint, tests, build, and Docker image build
- `stag -> prod`: promotion Pull Request allowed only from `stag`
- `push` to `stag` or `prod`: deployment workflow uses AWS OIDC and builds the application/container artifacts
- `prod` Pull Requests: drift-report and promotion-source workflows enforce branch discipline
- `Create Promotion PR`: manual workflow that opens the `stag` to `prod` promotion PR when one does not already exist

The `Create Promotion PR` workflow requires the `PROMOTION_PR_TOKEN` repository
secret. Use a fine-grained GitHub token with access to this repository and
pull request read/write permission.

## Documentation

- [docs/README.md](docs/README.md) - docs index and reading guide
- [docs/architecture.md](docs/architecture.md) - repository boundaries and architecture guidance
- [docs/development.md](docs/development.md) - local workflow, validation, and documentation rules
- [AGENTS.md](AGENTS.md) - instructions for AI contributors
