## Context

This repository is part of the FIAP Tech Challenge workshop system. Existing `AGENTS.md`, `CLAUDE.md`, and `.ai/` files tell agents how to work safely, but they do not require a formal OpenSpec proposal before implementation. The user has selected OpenSpec as the single governance workflow; Superpowers or other agent workflows are not the source of truth for this project.

## Goals / Non-Goals

**Goals:**
- Make OpenSpec the mandatory process for non-trivial changes.
- Keep agent instructions short and point to OpenSpec artifacts instead of duplicating product specs in `CLAUDE.md` or `AGENTS.md`.
- Ensure Claude Code raises product/architecture questions to Hermes/Void when the spec is missing or ambiguous.
- Preserve existing branch, PR, CI, and promotion rules.

**Non-Goals:**
- Do not define Phase 4 microservice architecture in this governance change.
- Do not change runtime code, Terraform resources, pipelines, or deployment behavior.
- Do not introduce Superpowers as a project governance requirement.

## Decisions

- Use `@fission-ai/openspec` as the OpenSpec CLI package because the bare `openspec` npm package has no executable.
- Store OpenSpec state inside each repository, not only in a parent folder, because each repository has independent PRs, CI checks, and ownership boundaries.
- Use the same change id, `adopt-openspec-governance`, across all four repositories to correlate this cross-repo governance bootstrap.
- Treat OpenSpec as canonical for future product/architecture/contract decisions; existing docs summarize implemented behavior and must be updated when specs are archived.

## Risks / Trade-offs

- The initial governance gate is documentation-enforced until a future CI check blocks implementation changes without an OpenSpec change id.
- OpenSpec adds process overhead; typo-only docs and no-behavior dependency lockfile refreshes are explicitly exempt.
- Cross-repo work still needs Hermes/Void orchestration because OpenSpec changes are repository-local.
