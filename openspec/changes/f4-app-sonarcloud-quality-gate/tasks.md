## 1. Validate OpenSpec Change

- [x] 1.1 Run `npx --yes @fission-ai/openspec validate f4-app-sonarcloud-quality-gate --strict` and confirm it passes with no errors.

## 2. Make coverage emit lcov

- [x] 2.1 Verify `package.json` already has a `test:coverage` script (`bun test --coverage`).
- [x] 2.2 Add `bunfig.toml` with `[test]` `coverage = true`, `coverageReporter = ["text", "lcov"]`, `coverageDir = "coverage"`.
- [x] 2.3 Run `bun run test:coverage` locally and confirm `coverage/lcov.info` is created and non-empty.

## 3. Wire SonarCloud into CI

- [x] 3.1 Add `sonar-project.properties` at repo root with `sonar.projectKey=tech-challenges-fiap_workshop-app`, `sonar.sources=src`, `sonar.javascript.lcov.reportPaths=coverage/lcov.info`.
- [x] 3.2 Update the `Test` step in the `test` job of `.github/workflows/pr-validation.yml` to run `bun run test:coverage` instead of `bun test`.
- [x] 3.3 Add a `Sonar` step to the `test` job, after `Test`, using `SonarSource/sonarcloud-github-action@v3.1.0` with `SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}`.
- [x] 3.4 Confirm `lint`, `build`, `container`, and `k8s` jobs are untouched and remain independent of the new Sonar step.

## 4. Verify and Hand Off

- [x] 4.1 Run `bun install`, `bun run lint`, `bun test`, `bun run test:coverage`, `bun run build` locally and confirm results.
- [x] 4.2 Re-run `npx --yes @fission-ai/openspec validate f4-app-sonarcloud-quality-gate --strict` after all edits. PASSED.
- [x] 4.3 Sanity-check `.github/workflows/pr-validation.yml` parses as valid YAML.
- [ ] 4.4 Open a PR into `stag` referencing this change id, noting `SONAR_TOKEN` is not yet configured for `tech-challenges-fiap/workshop-app` and the Sonar step is expected to fail until a human runs `gh secret set SONAR_TOKEN --repo tech-challenges-fiap/workshop-app`.
