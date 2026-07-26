## ADDED Requirements

### Requirement: CI produces persisted lcov coverage

`workshop-app` SHALL emit a `coverage/lcov.info` file when `bun run test:coverage` runs, using a version-controlled `bunfig.toml` `[test]` configuration rather than an ad hoc CLI flag only.

#### Scenario: Coverage script runs locally or in CI
- **WHEN** `bun run test:coverage` is executed, locally or in the `test` job of `.github/workflows/pr-validation.yml`
- **THEN** a non-empty `coverage/lcov.info` file is produced in the repository's `coverage/` directory

### Requirement: CI runs a SonarCloud scan as a non-blocking step

The `test` job in `.github/workflows/pr-validation.yml` SHALL include a step that runs `SonarSource/sonarcloud-github-action` against `coverage/lcov.info` after tests execute, without blocking the `lint`, `build`, `container`, or `k8s` jobs.

#### Scenario: Sonar step runs after tests produce coverage
- **WHEN** the `test` job runs in CI
- **THEN** the `Test` step (`bun run test:coverage`) executes first and produces `coverage/lcov.info`
- **AND** a subsequent `Sonar` step runs `SonarSource/sonarcloud-github-action@v3.1.0` reading `SONAR_TOKEN` from `secrets.SONAR_TOKEN` and `sonar.javascript.lcov.reportPaths` from `sonar-project.properties`

#### Scenario: SONAR_TOKEN secret is not yet configured
- **WHEN** the `tech-challenges-fiap/workshop-app` GitHub repository does not yet have a `SONAR_TOKEN` secret configured
- **THEN** the `Sonar` step is expected to fail, but the `lint`, `build`, `container`, and `k8s` jobs remain unaffected because they are independent jobs that do not depend on the Sonar step

### Requirement: Project analysis configuration is declared at repo root

`workshop-app` SHALL declare its SonarCloud project analysis configuration in a `sonar-project.properties` file at the repository root.

#### Scenario: Sonar scanner reads project configuration
- **WHEN** the `Sonar` step runs the SonarCloud scanner
- **THEN** it reads `sonar.projectKey=tech-challenges-fiap_workshop-app`, `sonar.sources=src`, and `sonar.javascript.lcov.reportPaths=coverage/lcov.info` from `sonar-project.properties` at the repository root
