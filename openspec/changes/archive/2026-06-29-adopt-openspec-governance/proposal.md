## Why

The repository already has agent instructions, branch rules, and validation commands, but it lacks a formal spec gate before implementation. For the FIAP Tech Challenge Phase 4 work, product, architecture, contracts, infrastructure, and behavior changes need one source of truth before Claude Code or any agent edits implementation files.

## What Changes

- Add OpenSpec scaffolding for Claude Code.
- Add repository-specific OpenSpec project context.
- Add an OpenSpec governance capability that makes proposal, spec delta, task list, validation, PR reference, and archive discipline mandatory for non-trivial changes.
- Update `AGENTS.md` and `CLAUDE.md` so agents stop when no OpenSpec change exists instead of inventing scope.

## Capabilities

### New Capabilities
- `openspec-governance`: Mandatory spec-driven change workflow for repository changes.

### Modified Capabilities
- None.

## Impact

- Affects agent workflow and documentation only.
- Does not change runtime behavior, infrastructure resources, API contracts, or deployment output.
- Adds a repeatable gate for future Phase 4 work: propose, validate, implement, verify, PR, archive.
