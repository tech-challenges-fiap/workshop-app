## Context

Fase 4 closure plan gap #3 requires SonarCloud static-analysis/quality-gate scanning in CI for `workshop-app`, `workshop-billing`, and `workshop-execution`. None of the six repos in the platform have SonarQube/SonarCloud wired up today, and `workshop-app` has no persisted coverage artifact. `workshop-app`'s `ci` pipeline currently runs `lint`, `test`, `build`, `container`, and `k8s` as separate jobs in `.github/workflows/pr-validation.yml`; the `test` job already provisions a real PostgreSQL service container.

## Goals / Non-Goals

**Goals:**
- Make `bun run test:coverage` deterministically emit `coverage/lcov.info` using Bun's native coverage support (verified against the installed Bun 1.3.11 in this workspace via `bun test --help`, which exposes `--coverage-reporter` and `--coverage-dir`; the equivalent persistent `bunfig.toml` keys are `coverageReporter` and `coverageDir` under `[test]`).
- Run a SonarCloud scan against that lcov file as part of the `test` job, after the `Test` step, so lint/test/build stay green independently of Sonar Cloud project setup.
- Keep the Sonar step additive: it must not gate or block `lint`, `build`, `container`, or `k8s`.

**Non-Goals:**
- Configuring the actual SonarCloud organization/project or the `SONAR_TOKEN` secret — that is a human follow-up tracked outside this change.
- Enforcing a Sonar Quality Gate as a hard CI gate (e.g. `sonar.qualitygate.wait=true`) in this first pass; that can be a follow-up once the org/token exists and a baseline quality gate result is established.
- Changing test business logic, coverage thresholds, or adding new tests.

## Decisions

- **Coverage mechanism**: use `bunfig.toml` `[test]` section (`coverage = true`, `coverageReporter = ["text", "lcov"]`, `coverageDir = "coverage"`) rather than relying solely on the `--coverage` CLI flag, because `bunfig.toml` is the persistent, version-controlled source of truth and works identically for local runs and CI runs of `bun run test:coverage` (which invokes `bun test --coverage`).
- **CI step placement**: add the SonarCloud step to the existing `test` job, after `Test`, instead of creating a new dedicated job, so the lcov artifact produced in the same job/runner filesystem is available without needing `actions/upload-artifact` + `actions/download-artifact` round-tripping between jobs.
- **Action version**: pin `SonarSource/sonarqube-scan-action@v8.2.1`. `SonarSource/sonarcloud-github-action` (originally pinned at `v3.1.0`) is now archived — its GitHub repo is flagged `archived: true` and its description reads "Deprecated. Use https://github.com/SonarSource/sonarqube-scan-action instead." — so the step was switched to the actively maintained action. Input names (`args`, `projectBaseDir`, `scannerVersion`, `scannerBinariesUrl`) are unchanged between the two actions, and `SONAR_TOKEN`/`GITHUB_TOKEN` are still read from the environment by the underlying scanner CLI in both, so no other step config changed.
- **Required-check isolation (corrected after review)**: `test` is a **required status check** on both `stag` and `prod` branch protection for this repo (`gh api repos/tech-challenges-fiap/workshop-app/branches/stag/protection` lists `lint`, `test`, `build`, `container`, `k8s`). A GitHub Actions job fails as a whole when any of its steps fails, so an un-mitigated Sonar step failure (guaranteed until `SONAR_TOKEN` exists) would fail the `test` required check and block every PR into `stag`/`prod`, not just annotate the Sonar step. The fix is `continue-on-error: true` on the `Sonar` step: the step's own result is still visible (shown with a warning indicator, not counted toward job failure), but the `test` job's overall/required status reflects `Checkout`/`Setup Bun`/`Install dependencies`/`Test` only. `continue-on-error` was chosen over splitting Sonar into its own job because a separate job would need `actions/upload-artifact` + `actions/download-artifact` to move `coverage/lcov.info` between runners (this repo has no existing artifact-passing convention), which is more moving parts for the same outcome; `continue-on-error` is the smaller, more surgical fix and keeps the coverage-to-scan flow within one job.

## Risks / Trade-offs

- Until `SONAR_TOKEN` is set via `gh secret set SONAR_TOKEN --repo tech-challenges-fiap/workshop-app`, the `Sonar` step will show as failed (non-blocking, thanks to `continue-on-error: true`) in the `test` job's step list, while the job's overall/required status remains green as long as `lint`/`test`/`build` themselves pass. This is expected per the closure plan.
- Bun's coverage instrumentation adds runtime overhead to `bun run test:coverage`; this only affects CI's `test` step, not `bun test` used for quick local iteration (both now honor the same `bunfig.toml`, so plain `bun test` also prints a coverage table locally — this is a cosmetic, non-blocking side effect).
- `sonar.tests=src` and `sonar.exclusions=**/*.test.ts` (added after review) ensure co-located `*.test.ts` files under `src/` are classified as test code, not double-counted as production source in coverage/issue metrics.
