# workshop-app docs

This directory is the central documentation hub for the `workshop` platform.
Transversal documents (diagrams, RFCs, ADRs, ER model) live here. Each
satellite repository (`workshop-db`, `workshop-edge`, `workshop-platform`) has
its own local docs for its scope only.

## Read This First

- Start with [../README.md](../README.md) for the repository purpose, commands, and delivery flow.
- Read [architecture.md](architecture.md) if you are deciding where a change belongs.
- Read [development.md](development.md) if you are implementing or reviewing changes.
- Read [../AGENTS.md](../AGENTS.md) if you are using an AI agent in this repository.

## Document Map

### This repository

- [architecture.md](architecture.md) — application boundaries and architecture guidance
- [development.md](development.md) — prerequisites, local commands, workflow expectations, and doc rules
- [../AGENTS.md](../AGENTS.md) — repo instructions for AI agents
- [../.ai/project-context.md](../.ai/project-context.md) — compact AI-readable project context
- [../.ai/contributing.md](../.ai/contributing.md) — AI-assisted change checklist
- [../.ai/task-template.md](../.ai/task-template.md) — reusable task brief template

### Transversal architecture (platform-wide)

- [component-diagram.md](component-diagram.md) — cloud component diagram: API Gateway, Lambda, EKS (`stag`/`prod` namespaces), RDS, Datadog, internal layers
- [sequence-diagrams.md](sequence-diagrams.md) — authentication flow (CPF → JWT) and work-order creation flow
- [er-diagram.md](er-diagram.md) — full ER diagram with table descriptions and migration rationale

### RFCs

- [rfcs/RFC-001-cloud-provider.md](rfcs/RFC-001-cloud-provider.md) — choice of AWS as the cloud provider
- [rfcs/RFC-002-authentication-strategy.md](rfcs/RFC-002-authentication-strategy.md) — CPF + Lambda `auth-cpf` + JWT HS256 authentication strategy

### ADRs

- [adrs/ADR-001-communication-pattern.md](adrs/ADR-001-communication-pattern.md) — REST HTTP/JSON over Hono as the communication pattern
- [adrs/ADR-002-hpa-autoscaling.md](adrs/ADR-002-hpa-autoscaling.md) — HPA for horizontal autoscaling of the application

### Satellite repository docs

- [workshop-db — database-choice.md](https://github.com/tech-challenges-fiap/workshop-db/blob/stag/docs/database-choice.md) — formal justification for PostgreSQL
- [workshop-db — architecture.md](https://github.com/tech-challenges-fiap/workshop-db/blob/stag/docs/architecture.md) — database repository boundaries
- [workshop-edge — architecture.md](https://github.com/tech-challenges-fiap/workshop-edge/blob/stag/docs/architecture.md) — edge/Lambda repository boundaries
- [workshop-platform — architecture.md](https://github.com/tech-challenges-fiap/workshop-platform/blob/stag/docs/architecture.md) — shared infrastructure boundaries

## Who Should Read What

- Evaluators / new engineers: start with [component-diagram.md](component-diagram.md) then [sequence-diagrams.md](sequence-diagrams.md)
- Engineers deciding where a change belongs: `architecture.md` of the relevant repo
- Engineers investigating the data model: [er-diagram.md](er-diagram.md)
- Engineers reviewing design decisions: `rfcs/` and `adrs/`
- AI-assisted contributors: `AGENTS.md` and `.ai/project-context.md`
