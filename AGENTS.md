# AGENTS.md

## Mission

Work in `workshop-app` as an application repository. Keep this repo focused on
service behavior, domain/application logic, and runtime packaging.

## Scope Boundaries

In scope:

- Bun application code in `src/`
- service tests in `test/`
- container/runtime behavior
- app-focused documentation

Out of scope:

- gateway-specific adapters
- infrastructure provisioning
- shared runtime platform bootstrap

## Read First

- `README.md`
- `docs/architecture.md`
- `docs/development.md`
- `src/app.ts`
- `src/server.ts`
- `test/app.test.ts`

## Validation Commands

```bash
bun run lint
bun test
bun run build
docker build --tag workshop-app:local .
```

Run all relevant validation for any behavior change. For documentation-only
changes, still verify that documented commands and paths are correct.

## Workflow Rules

- Always run `git fetch origin --prune` before starting work.
- Always create a new branch from the updated `origin/stag`.
- Always open feature, fix, docs, and maintenance PRs into `stag`.
- Never open a direct PR to `prod`.
- Treat `prod` as promotion-only and update it only through the `stag -> prod` promotion PR.
- Before opening or updating a PR, verify that your branch is still based on current `origin/stag`.
- Stage files explicitly when the worktree contains unrelated changes.
- Never push directly to `stag` or `prod`.

## CI And Completion Rules

- Before saying the task is done, check the PR's required CI statuses.
- If CI fails, try to fix it once.
- If CI still fails after one reasonable fix attempt, stop and ask for help with the failure details.
- When reporting completion, include the branch name, PR URL, CI status, and any remaining blocker or risk.

## Promotion Rules

- Promotion PRs must always be `stag -> prod`.
- Promotion PRs must be merged with a merge commit.
- Do not use squash or rebase merges for promotions.

## Conflict Handling

- If a `stag -> prod` PR conflicts, do not create a direct branch or PR into `prod`.
- First inspect whether the conflict comes from broken promotion ancestry or from real content divergence.
- If branch protection or repository policy blocks the repair, stop and explain the exact maintainer action required.

## Writing Rules

- Write docs and AI guidance in English
- Do not invent endpoints, persistence layers, or workflows that are not present
- Keep repository boundaries explicit
- Prefer small, accurate updates over aspirational claims

## Documentation Expectations

Update `README.md`, `docs/`, and `.ai/` when you change:

- commands
- file layout
- implemented endpoints
- ownership boundaries
- CI or delivery behavior
