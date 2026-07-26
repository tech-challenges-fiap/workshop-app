# Evidence — f4-os-service-boundary

**Change ID:** f4-os-service-boundary  
**Repository:** workshop-app  
**Date:** 2026-07-17  
**Checklist columns supported:** Foundation / Documentation / Architecture

---

## Change Summary

Documentation-only change: designates `workshop-app` as the OS (Orchestration Service) for Phase 4, documents primary-data tables vs. read-model projections, adds a Data Ownership section prohibiting cross-service SQL connections, annotates schema files, and updates `openspec/project.md` with Phase 4 context.

**Artifacts created/modified:**
- `docs/architecture.md` — Data Ownership section, Phase 4 boundary language
- `README.md` — "What this repository owns" section updated
- `openspec/project.md` — OS Service designation, Phase 4 context
- `src/infrastructure/db/schema/person.ts` — read-model projection comment
- `src/infrastructure/db/schema/vehicle.ts` — read-model projection comment
- `openspec/changes/f4-os-service-boundary/` — proposal, design, spec, tasks

---

## Validation Commands and Results

### 1. OpenSpec Validation

```
$ cd /root/repos/tech-challenges-fiap/workshop-app
$ npx --yes @fission-ai/openspec validate f4-os-service-boundary --strict
Change 'f4-os-service-boundary' is valid
```

**Result: PASSED**

### 2. Lint

```
$ bun run lint
$ eslint .
(exit 0 — no output means no errors)
```

**Result: PASSED**

### 3. Build

```
$ bun run build
$ tsc -p tsconfig.build.json
(exit 0)
```

**Result: PASSED**

### 4. Architecture Check

```
$ bun run arch:check
$ bun run scripts/architecture-gate.ts check
Architecture check (offline-fallback): 0 violation(s), 46 accepted edge(s).
```

**Result: PASSED — 0 violations, 46 accepted edges**

### 5. Tests

Docker PostgreSQL was available as `workshop_postgres` and was restarted before the verification run:

```
$ docker start workshop_postgres
workshop_postgres

$ docker inspect -f '{{.State.Health.Status}}' workshop_postgres
healthy
```

The full test suite was then run against the Docker-served test database using loopback so host-run tests do not rely on Docker-internal DNS:

```
$ DATABASE_URL_TEST='postgresql://workshop_user:workshop_password@127.0.0.1:5432/workshop_db_test' \
  POSTGRES_HOST=127.0.0.1 \
  POSTGRES_USER=workshop_user \
  POSTGRES_PASSWORD=workshop_password \
  POSTGRES_DB_TEST=workshop_db_test \
  bun test

411 pass
0 fail
923 expect() calls
Ran 411 tests across 75 files. [2.92s]
```

**Result: PASSED — 411 pass, 0 fail**

---

## Archive Status

Archiving proceeded because:
- OpenSpec validation: PASSED (strict)
- Lint: PASSED
- Build: PASSED
- arch:check: PASSED (0 violations)
- Tests: PASSED with Docker PostgreSQL (`workshop_postgres`) and loopback `DATABASE_URL_TEST`

Archive record: `openspec/changes/archive/2026-07-17-f4-os-service-boundary/`  
Archive command output: `Change 'f4-os-service-boundary' archived as '2026-07-17-f4-os-service-boundary'.` (1 incomplete task skipped via --yes: PR task, explicitly excluded from this session scope)
