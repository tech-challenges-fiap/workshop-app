# workshop-app

[![Prod/Stag sync](https://github.com/tech-challenges-fiap/workshop-app/actions/workflows/branch-sync.yml/badge.svg)](https://github.com/tech-challenges-fiap/workshop-app/actions/workflows/branch-sync.yml)

`workshop-app` is the main application repository for the `workshop` service.
It owns the HTTP API, domain and application logic, PostgreSQL schema
evolution, migrations, seeds, runtime packaging, and Kubernetes deployment
assets.

This repository does not own API Gateway, edge Lambdas, EKS provisioning, or
RDS provisioning.

## What this repository owns

- Bun-based Hono HTTP API.
- Workshop domain and application use cases.
- Drizzle schema, SQL migrations, seeds, and PostgreSQL repositories.
- External JWT validation for tokens issued by `workshop-edge`.
- JSON request logs, request correlation, and OpenTelemetry bootstrap.
- Docker image and Kubernetes manifests for `stag` and `prod`.

## Runtime contract

The official authentication flow is:

```text
API Gateway -> Lambda auth-cpf -> JWT -> workshop-app
```

`workshop-app` validates the JWT signature with `JWT_SECRET`, requires
`JWT_ISSUER=workshop-edge`, requires `JWT_AUDIENCE=workshop-app`, checks token
expiration, and requires the claims `sub`, `person_id`, `cpf`, `role`,
`status`, `iss`, `aud`, `exp`, `iat`, and `jti`.

The app accepts protected requests only when `status` is `active`. It does not
log raw CPF values or bearer tokens.

## Local commands

```bash
bun install
bun run dev
bun run lint
bun test
bun run build
bun run db:migrate
bun run db:seed
docker build --tag workshop-app:local .
```

Default local runtime:

- Application port: `3000`
- Health endpoint: `http://localhost:3000/health`
- Readiness endpoint: `http://localhost:3000/ready`

PostgreSQL configuration comes from `DATABASE_URL` or the `POSTGRES_*`
variables documented in `.env.example`.

## Delivery flow

- `feature/* -> stag`: Pull Request validated by lint, tests, build,
  Kubernetes manifest rendering, and Docker image build.
- `stag -> prod`: promotion Pull Request allowed only from `stag`.
- `push` to `stag` or `prod`: deployment workflow builds and pushes the image
  to ECR, applies Kubernetes manifests, runs the migration `Job`, and waits for
  the deployment rollout.
- `prod` Pull Requests: drift-report and promotion-source workflows enforce
  branch discipline.
- `Create Promotion PR`: manual workflow that opens the `stag` to `prod`
  promotion PR when one does not already exist.

The `Create Promotion PR` workflow requires the `PROMOTION_PR_TOKEN`
repository secret. Use a fine-grained GitHub token with access to this
repository and pull request read/write permission.

## Documentation

- [Docs index](docs/README.md)
- [Architecture](docs/architecture.md)
- [Development](docs/development.md)
- [AI contributor instructions](AGENTS.md)
