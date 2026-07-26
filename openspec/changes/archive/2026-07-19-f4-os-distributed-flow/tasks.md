# f4-os-distributed-flow Tasks

## 1. OpenSpec

- [x] Add distributed-flow requirements and scenarios under OS-owned specs.
- [x] Validate the change with `npx --yes @fission-ai/openspec validate f4-os-distributed-flow --strict` before implementation.

## 2. Implementation

- [x] Define OS-owned outbound distributed-flow event names/payloads for Billing authorization, Execution start, and compensation intent.
- [x] Extend the saga application layer so start/inbound transitions publish the correct outbound intents through the existing `WorkOrderEventPublisher` boundary.
- [x] Keep inbound Billing/Execution events idempotent and preserve correlation and event identity.
- [x] Avoid direct Billing/Execution persistence or live broker requirements in code and tests.

## 3. Tests and docs

- [x] Add focused tests for happy path, billing failure compensation, execution failure compensation, duplicate inbound events, and correlation propagation.
- [x] Update README/development/architecture docs with accurate distributed-flow behavior.
- [x] Add evidence under `docs/evidence/fase-4/f4-os-distributed-flow.md`.

## 4. Validation

- [x] Re-run strict OpenSpec validation.
- [x] Run `bun run lint`.
- [x] Run `bun run build`.
- [x] Run `bun run arch:check`.
- [x] Run full `bun test`.
- [x] If all validation passes, archive the OpenSpec change and validate specs strictly.
