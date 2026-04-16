# workshop-app

`workshop-app` is the primary application repository for the `workshop`
platform split. It is the future home of the domain and application logic that
currently lives together in the `14soat-group56` monolith.

## What This Repository Owns

- The Bun-based HTTP application
- Application and domain logic as it is extracted from the monolith
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

That means the repository is ready for incremental feature work, but it does
not yet contain the mechanical workshop domain model from `14soat-group56`.

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

## Documentation

- [docs/README.md](docs/README.md) - docs index and reading guide
- [docs/architecture.md](docs/architecture.md) - repository boundaries and target role in the split architecture
- [docs/development.md](docs/development.md) - local workflow, validation, and documentation rules
- [AGENTS.md](AGENTS.md) - instructions for AI contributors
