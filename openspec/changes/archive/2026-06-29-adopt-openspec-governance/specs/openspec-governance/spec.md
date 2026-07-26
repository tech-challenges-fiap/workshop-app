## ADDED Requirements

### Requirement: OpenSpec Change Required Before Non-Trivial Work
Agents MUST confirm an OpenSpec change exists under `openspec/changes/<change-id>/` before modifying implementation, infrastructure, API contract, schema, workflow, or runtime behavior files.

#### Scenario: Agent receives implementation request without change id
- **WHEN** an agent is asked to modify behavior, infrastructure, schema, contracts, or workflows and no relevant `openspec/changes/<change-id>/` exists
- **THEN** the agent stops and asks Hermes/Void for the OpenSpec change id instead of modifying files

#### Scenario: Agent receives documentation typo request
- **WHEN** an agent is asked to make a typo-only documentation fix with no behavior, contract, infrastructure, or workflow change
- **THEN** the agent may proceed without a proposal while still following repository validation and PR rules

### Requirement: OpenSpec Validation Required
Agents MUST run strict OpenSpec validation before implementation and before PR handoff for any non-exempt change.

#### Scenario: Change validation fails
- **WHEN** `npx --yes @fission-ai/openspec validate <change-id> --strict` fails
- **THEN** implementation and PR handoff are blocked until the OpenSpec artifacts are corrected

### Requirement: Implementation Scope Bound To Tasks
Implementation MUST stay within the tasks listed in `openspec/changes/<change-id>/tasks.md`.

#### Scenario: Implementation reveals additional scope
- **WHEN** an implementation requires behavior, contract, infrastructure, or workflow changes not represented in `tasks.md` and the spec delta
- **THEN** the agent updates the OpenSpec change and revalidates before continuing

### Requirement: PRs Reference OpenSpec Change
Pull requests for non-exempt work MUST reference the OpenSpec change id and validation result.

#### Scenario: Agent prepares PR body
- **WHEN** an agent opens or updates a PR for non-exempt work
- **THEN** the PR body includes the OpenSpec change id and the strict validation command/result

### Requirement: Completed Changes Archived After Merge
Merged OpenSpec changes MUST be archived after they land in `stag`.

#### Scenario: PR merges into stag
- **WHEN** a PR implementing an OpenSpec change merges into `stag`
- **THEN** the change is archived with `npx --yes @fission-ai/openspec archive <change-id>` in the same or a follow-up PR
