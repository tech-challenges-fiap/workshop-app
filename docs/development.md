# Developing In workshop-app

## Prerequisites

- Bun `>= 1.3.6`
- Docker if you need to validate the container image

## Local Workflow

Install dependencies:

```bash
bun install
```

Run the local server:

```bash
bun run dev
```

Validate the repository:

```bash
bun run lint
bun test
bun run build
docker build --tag workshop-app:local .
```

## What The Commands Do

- `bun run dev` starts the Bun server from `src/server.ts`
- `bun run lint` runs the repository whitespace and formatting guard in `scripts/lint.ts`
- `bun test` executes the Bun test suite in `test/`
- `bun run build` compiles the server into `dist/`
- `docker build ...` validates the production image contract used in CI

## Branching and Delivery Expectations

- Build features from `feature/*` branches
- Open Pull Requests into `stag` for normal integration
- Promote to `prod` only from `stag`
- Expect `pr-validation.yml` to run lint, test, build, and container validation
- Expect `promotion-source.yml` and `drift-report.yml` to guard production promotions

## Documentation Rules

- Write all documentation in English
- Keep docs faithful to the current repository state
- When a command, endpoint, directory, or workflow changes, update the relevant docs in the same change
- Do not document planned behavior as implemented unless it exists here

## When To Update Documentation

Update documentation when you change:

- runtime entrypoints or local commands
- implemented HTTP endpoints
- repository boundaries or ownership decisions
- CI validation or deployment workflows
- AI contributor guidance in `AGENTS.md` or `.ai/`
