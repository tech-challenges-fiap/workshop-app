## Why

Phase 4 closure requires static-analysis and quality-gate scanning in CI for `workshop-app`, `workshop-billing`, and `workshop-execution`. None of the six repositories in the platform currently run SonarQube/SonarCloud, and `workshop-app` does not persist test coverage anywhere. This change closes that gap for `workshop-app` by producing lcov coverage locally in CI and scanning it with SonarCloud as part of the existing `ci` pipeline, without blocking `lint`, `test`, or `build` on the Sonar step.

`test` is a **required status check** for both `stag` and `prod` branch protection (confirmed via `gh api repos/tech-challenges-fiap/workshop-app/branches/stag/protection`). The Sonar step runs inside the `test` job, so without a mitigation, a step failure (guaranteed until `SONAR_TOKEN` exists) would fail the whole required `test` check and block every PR into `stag`/`prod`. The step therefore uses `continue-on-error: true` so the `test` job's required status reflects lint/test/build outcomes only, while the Sonar step's own outcome is still visible (as a non-blocking warning) in the job's step list.

## What Changes

- Ensure `bun run test:coverage` actually emits `coverage/lcov.info` by adding a `bunfig.toml` with `[test]` coverage settings (`coverageReporter = ["text", "lcov"]`, `coverageDir = "coverage"`).
- Change the `test` job's `Test` step in `.github/workflows/pr-validation.yml` to run `bun run test:coverage` instead of plain `bun test`, so lcov output exists before scanning.
- Add a `Sonar` step to the `test` job using `SonarSource/sonarqube-scan-action@v8.2.1` (the current, non-deprecated action; `SonarSource/sonarcloud-github-action` is archived and redirects to this action), reading `SONAR_TOKEN` from repository secrets, placed after the `Test` step so `coverage/lcov.info` is available. The step sets `continue-on-error: true` so it cannot fail the required `test` status check while `SONAR_TOKEN` is missing.
- Add a `sonar-project.properties` file at the repo root declaring `sonar.projectKey=tech-challenges-fiap_workshop-app`, `sonar.sources=src`, `sonar.tests=src` with `sonar.test.inclusions=**/*.test.ts` and `sonar.exclusions=**/*.test.ts` (so co-located `*.test.ts` files are classified as tests, not double-counted as production source), and `sonar.javascript.lcov.reportPaths=coverage/lcov.info`.
- Document that `SONAR_TOKEN` is not yet configured in the `tech-challenges-fiap/workshop-app` GitHub repository; the new Sonar step will fail until a human creates a SonarCloud org/project and runs `gh secret set SONAR_TOKEN --repo tech-challenges-fiap/workshop-app`. Because of `continue-on-error: true`, this does not block `lint`, `test`, or `build`, which remain independent, passing steps/jobs and keep their required-check status green.

## Capabilities

### New Capabilities
- `sonarcloud-quality-gate`: Declares that `workshop-app` CI produces persisted lcov coverage and runs a SonarCloud scan as a non-blocking (`continue-on-error`) step of the `test` job, pending the `SONAR_TOKEN` secret, without affecting the required `test` status check.

### Modified Capabilities
(none)

## Impact

- Affects `.github/workflows/pr-validation.yml` (`test` job only), adds `bunfig.toml` and `sonar-project.properties` at repo root.
- No runtime behavior, API contract, or database schema changes.
- `lint`, `test`, `build`, `container`, and `k8s` jobs/steps are unaffected and continue to gate the PR independently of the new Sonar step; `continue-on-error: true` ensures the required `test` status check passes even while the Sonar step itself fails for lack of `SONAR_TOKEN`.
- Until `SONAR_TOKEN` is configured by a human operator, the Sonar step is expected to show as failed (non-blocking) in the `test` job's step list; this is a known, accepted follow-up outside this change's scope.
