## Why

Phase 4 closure requires static-analysis and quality-gate scanning in CI for `workshop-app`, `workshop-billing`, and `workshop-execution`. None of the six repositories in the platform currently run SonarQube/SonarCloud, and `workshop-app` does not persist test coverage anywhere. This change closes that gap for `workshop-app` by producing lcov coverage locally in CI and scanning it with SonarCloud as part of the existing `ci` pipeline, without blocking `lint`, `test`, or `build` on the Sonar step.

## What Changes

- Ensure `bun run test:coverage` actually emits `coverage/lcov.info` by adding a `bunfig.toml` with `[test]` coverage settings (`coverageReporter = ["text", "lcov"]`, `coverageDir = "coverage"`).
- Change the `test` job's `Test` step in `.github/workflows/pr-validation.yml` to run `bun run test:coverage` instead of plain `bun test`, so lcov output exists before scanning.
- Add a `Sonar` step to the `test` job using `SonarSource/sonarcloud-github-action@v3.1.0`, reading `SONAR_TOKEN` from repository secrets, placed after the `Test` step so `coverage/lcov.info` is available.
- Add a `sonar-project.properties` file at the repo root declaring `sonar.projectKey=tech-challenges-fiap_workshop-app`, `sonar.sources=src`, and `sonar.javascript.lcov.reportPaths=coverage/lcov.info`.
- Document that `SONAR_TOKEN` is not yet configured in the `tech-challenges-fiap/workshop-app` GitHub repository; the new Sonar step will fail until a human creates a SonarCloud org/project and runs `gh secret set SONAR_TOKEN --repo tech-challenges-fiap/workshop-app`. This is expected and does not block `lint`, `test`, or `build`, which remain independent, passing steps/jobs.

## Capabilities

### New Capabilities
- `sonarcloud-quality-gate`: Declares that `workshop-app` CI produces persisted lcov coverage and runs a SonarCloud scan as a non-blocking step of the `test` job, pending the `SONAR_TOKEN` secret.

### Modified Capabilities
(none)

## Impact

- Affects `.github/workflows/pr-validation.yml` (`test` job only), adds `bunfig.toml` and `sonar-project.properties` at repo root.
- No runtime behavior, API contract, or database schema changes.
- `lint`, `test`, `build`, `container`, and `k8s` jobs/steps are unaffected and continue to gate the PR independently of the new Sonar step.
- Until `SONAR_TOKEN` is configured by a human operator, the Sonar step is expected to fail; this is a known, accepted follow-up outside this change's scope.
