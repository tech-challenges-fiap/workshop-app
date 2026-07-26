## ADDED Requirements

### Requirement: CI produces persisted lcov coverage

`workshop-app` SHALL emit a `coverage/lcov.info` file when `bun run test:coverage` runs, using a version-controlled `bunfig.toml` `[test]` configuration rather than an ad hoc CLI flag only.

#### Scenario: Coverage script runs locally or in CI
- **WHEN** `bun run test:coverage` is executed, locally or in the `test` job of `.github/workflows/pr-validation.yml`
- **THEN** a non-empty `coverage/lcov.info` file is produced in the repository's `coverage/` directory

### Requirement: CI runs a SonarCloud scan without failing the required test check

The `test` job in `.github/workflows/pr-validation.yml` SHALL include a step that runs `SonarSource/sonarqube-scan-action` against `coverage/lcov.info` after tests execute, configured so its own failure cannot fail the `test` job — because `test` is a required branch-protection status check on `stag` and `prod` — while remaining visible as a non-blocking result.

#### Scenario: Sonar step runs after tests produce coverage
- **WHEN** the `test` job runs in CI
- **THEN** the `Test` step (`bun run test:coverage`) executes first and produces `coverage/lcov.info`
- **AND** a subsequent `Sonar` step runs `SonarSource/sonarqube-scan-action@v8.2.1` with `continue-on-error: true`, reading `SONAR_TOKEN` from `secrets.SONAR_TOKEN` and `sonar.javascript.lcov.reportPaths` from `sonar-project.properties`

#### Scenario: SONAR_TOKEN secret is not yet configured
- **WHEN** the `tech-challenges-fiap/workshop-app` GitHub repository does not yet have a `SONAR_TOKEN` secret configured
- **THEN** the `Sonar` step is expected to fail
- **AND** because the step has `continue-on-error: true`, the failure does not fail the `test` job or the required `test` status check
- **AND** the `lint`, `build`, `container`, and `k8s` jobs remain unaffected because they are independent jobs that do not depend on the Sonar step

### Requirement: Project analysis configuration is declared at repo root

`workshop-app` SHALL declare its SonarCloud project analysis configuration in a `sonar-project.properties` file at the repository root, classifying co-located test files separately from production source.

#### Scenario: Sonar scanner reads project configuration
- **WHEN** the `Sonar` step runs the SonarCloud scanner
- **THEN** it reads `sonar.projectKey=tech-challenges-fiap_workshop-app`, `sonar.sources=src`, and `sonar.javascript.lcov.reportPaths=coverage/lcov.info` from `sonar-project.properties` at the repository root

#### Scenario: Co-located test files are classified as tests, not production source
- **GIVEN** `workshop-app` keeps `*.test.ts` files co-located with source files under `src/`
- **WHEN** the Sonar scanner analyzes the repository
- **THEN** it reads `sonar.tests=src` and `sonar.test.inclusions=**/*.test.ts` so files matching `**/*.test.ts` under `src/` are classified as test code
- **AND** it reads `sonar.exclusions=**/*.test.ts` so those same files are excluded from the production-source scan, preventing double-counting in coverage and issue metrics
