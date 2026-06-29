# OpenSpec Agent Workflow

This repository uses OpenSpec as the mandatory governance process for non-trivial work.

## Canonical Rule

Do not modify implementation, infrastructure, API contract, schema, workflow, or runtime behavior files unless a relevant OpenSpec change exists under `openspec/changes/<change-id>/` and validates successfully.

## Required Flow

1. **Explore** existing specs, docs, and source before proposing a change.
2. **Propose** a change under `openspec/changes/<change-id>/` with:
   - `proposal.md`
   - `tasks.md`
   - spec deltas under `specs/<capability>/spec.md`
   - `design.md` when architecture, infra, contracts, data ownership, or cross-repo coordination is involved.
3. **Validate** before implementation:

   ```bash
   npx --yes @fission-ai/openspec validate <change-id> --strict
   ```

4. **Implement** only the tasks and requirements inside the approved change.
5. **Revalidate** before PR handoff with the same strict command.
6. **Reference** the change id and validation result in the PR body.
7. **Archive** after merge to `stag`:

   ```bash
   npx --yes @fission-ai/openspec archive <change-id>
   ```

## Hermes/Void Coordination

- Hermes/Void owns product and architecture clarification.
- Claude Code executes repository investigation, spec drafting, implementation, tests, and review tasks.
- If a spec is missing, ambiguous, or conflicts with implementation reality, stop and raise the question to Hermes/Void.
- Do not silently choose product scope, contract changes, database ownership, infrastructure topology, or Saga behavior.

## Exemptions

A proposal is not required for:

- typo-only documentation fixes;
- dependency lockfile refreshes with no behavior, contract, infrastructure, or workflow change.

When in doubt, require OpenSpec.

## Tooling

Use the package-scoped CLI. The bare `openspec` npm package does not provide the expected executable.

```bash
npx --yes @fission-ai/openspec --help
npx --yes @fission-ai/openspec validate --help
```
