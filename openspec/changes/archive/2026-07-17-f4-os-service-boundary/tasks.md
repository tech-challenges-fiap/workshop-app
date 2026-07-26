## 1. Validate OpenSpec Change

- [x] 1.1 Run `npx --yes @fission-ai/openspec validate f4-os-service-boundary --strict` and confirm it passes with no errors.

## 2. Update Architecture Documentation

- [x] 2.1 Update `docs/architecture.md` to explicitly state that `workshop-app` is the OS Service for Phase 4 and list its primary-data tables (`work_orders`, `work_order_status_history`) vs. read-model projection tables (`persons`, `vehicles`).
- [x] 2.2 Add a "Data Ownership" section to `docs/architecture.md` that names the cross-service prohibition: no direct SQL connections to Billing or Execution databases.
- [x] 2.3 Update `README.md` "What this repository owns" section to reflect the Phase 4 boundary language from this spec.

## 3. Update OpenSpec Project Context

- [x] 3.1 Update `openspec/project.md` to include the OS Service designation, Phase 4 context, and the data-ownership boundary so future agents have this context when proposing changes.

## 4. Annotate Projection Tables in Schema Documentation

- [x] 4.1 Add a brief comment block at the top of `src/infrastructure/db/schema/person.ts` (or equivalent) marking the `person` table as a read-model projection for Phase 4, referencing the `f4-os-service-boundary` change id.
- [x] 4.2 Add a similar comment block at the top of `src/infrastructure/db/schema/vehicle.ts` (or equivalent) for the `vehicle` table.

## 5. Verify and Hand Off

- [x] 5.1 Re-run `npx --yes @fission-ai/openspec validate f4-os-service-boundary --strict` after all documentation updates. PASSED.
- [x] 5.2 Run `bun run lint && bun test && bun run build && bun run arch:check` to confirm no regressions from documentation-only edits. PASSED with Bun v1.3.14 and Docker PostgreSQL: `bun run lint` PASSED, `bun test` PASSED (411 pass, 0 fail), `bun run build` PASSED, and `bun run arch:check` PASSED with 0 violation(s) and 46 accepted edge(s).
- [ ] 5.3 Open a PR into `stag` referencing the change id `f4-os-service-boundary` and the strict validation result. NOT DONE: excluded from this session scope (no push/PR/commit).
