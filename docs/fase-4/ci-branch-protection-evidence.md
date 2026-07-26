# Phase 4 CI/CD and Branch Protection Evidence

Collected: `2026-07-19T13:17:39Z`  
Scope: read-only collection for FIAP Phase 4 checklist item 4. No GitHub settings were changed, and no commits/pushes/PRs were made.

## 1. Tool and repository mapping evidence

### GitHub CLI authentication

Command run:

```bash
gh auth status
```

Result summary, with token redacted:

```text
github.com
  ✓ Logged in to github.com account karel-kadlec (/root/.config/gh/hosts.yml)
  - Active account: true
  - Git operations protocol: https
  - Token: [REDACTED]
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'
```

### Local remotes inspected

Each local repository remote points to the expected `tech-challenges-fiap` GitHub organization:

| Local repo | Remote | Local HEAD / notes |
|---|---|---|
| `workshop-app` | `https://github.com/tech-challenges-fiap/workshop-app` | Local branch during collection: `f4-os-saga-orchestrator`; remote has `stag` and `prod`. |
| `workshop-billing` | `https://github.com/tech-challenges-fiap/workshop-billing` | Local repository has no commits yet on `main`; all files are untracked; remote API returned no branches. |
| `workshop-execution` | `https://github.com/tech-challenges-fiap/workshop-execution` | Local repository has no commits yet on `main`; all files are untracked; remote API returned no branches. |
| `workshop-edge` | `https://github.com/tech-challenges-fiap/workshop-edge` | Local branch during collection: `f4-edge-authenticated-smoke`; remote has `stag` and `prod`. |
| `workshop-platform` | `https://github.com/tech-challenges-fiap/workshop-platform` | Local branch during collection: `stag`; remote has `stag` and `prod`. |
| `workshop-db` | `https://github.com/tech-challenges-fiap/workshop-db` | Local branch during collection: `stag`; remote has `stag` and `prod`. |

Remote repo metadata from `gh repo view --json nameWithOwner,defaultBranchRef,url,isPrivate`:

| Repo | URL | Private? | Default branch from API |
|---|---|---:|---|
| `tech-challenges-fiap/workshop-app` | https://github.com/tech-challenges-fiap/workshop-app | false | `stag` |
| `tech-challenges-fiap/workshop-billing` | https://github.com/tech-challenges-fiap/workshop-billing | false | empty / no default branch reported |
| `tech-challenges-fiap/workshop-execution` | https://github.com/tech-challenges-fiap/workshop-execution | false | empty / no default branch reported |
| `tech-challenges-fiap/workshop-edge` | https://github.com/tech-challenges-fiap/workshop-edge | false | `stag` |
| `tech-challenges-fiap/workshop-platform` | https://github.com/tech-challenges-fiap/workshop-platform | false | `stag` |
| `tech-challenges-fiap/workshop-db` | https://github.com/tech-challenges-fiap/workshop-db | false | `stag` |

## 2. Local workflow files and what they validate

| Repo | Local workflow files found | Validation coverage |
|---|---|---|
| `workshop-app` | `.github/workflows/pr-validation.yml`; `create-promotion-pr.yml`; `deploy.yml`; `drift-report.yml`; `promotion-source.yml`; `update-prod-stag-badge.yml` | `pr-validation.yml` runs on PRs to `stag`/`prod` and has independent jobs for `lint`, `test` with PostgreSQL service, `build`, Docker `container` build, and `k8s` Kustomize render for stag/prod app and migrations. Promotion/drift/badge/deploy workflows also exist remotely. |
| `workshop-billing` | none; no `.github/workflows` directory found locally | Gap: no local CI workflow file was found. The local repo has service code/docs/Dockerfile, but CI/CD evidence is absent locally and remotely. |
| `workshop-execution` | `.github/workflows/ci.yml` | Local CI validates `lint`, `bun test`, and `bun run build`, but it is configured for `push`/`pull_request` on `main`, while the target org convention in other repos is `stag`/`prod`. No Docker or Kubernetes validation job is present. Remote repo currently has no branches/workflows exposed by GitHub API, so this local workflow is not proven active remotely. |
| `workshop-edge` | `.github/workflows/pr-validation.yml`; `create-promotion-pr.yml`; `deploy.yml`; `drift-report.yml`; `promotion-source.yml`; `update-prod-stag-badge.yml` | `pr-validation.yml` runs on PRs to `stag`/`prod` and has `terraform` validation (`fmt`, `init -backend=false`, `validate`) plus `lambdas` validation (`lint`, `test`, `build`, package). Promotion/drift/badge/deploy workflows also exist remotely. |
| `workshop-platform` | `.github/workflows/pr-validation.yml`; `create-promotion-pr.yml`; `deploy.yml`; `drift-report.yml`; `promotion-source.yml`; `update-prod-stag-badge.yml` | `pr-validation.yml` runs on PRs to `stag`/`prod` and validates Terraform (`fmt`, `init -backend=false`, `validate`) plus Kubernetes manifest structure via `./scripts/validate-k8s-manifests.sh`. Promotion/drift/badge/deploy workflows also exist remotely. |
| `workshop-db` | `.github/workflows/pr-validation.yml`; `create-promotion-pr.yml`; `deploy.yml`; `drift-report.yml`; `promotion-source.yml`; `update-prod-stag-badge.yml` | `pr-validation.yml` runs on PRs to `stag`/`prod` and validates Terraform (`fmt`, `init -backend=false`, `validate`). Promotion/drift/badge/deploy workflows also exist remotely. |

## 3. Remote GitHub Actions evidence

Commands used:

```bash
gh workflow list --repo tech-challenges-fiap/<repo> --limit 20
gh run list --repo tech-challenges-fiap/<repo> --branch stag --limit 8 --json databaseId,displayTitle,workflowName,status,conclusion,headBranch,event,createdAt,updatedAt,url
gh run list --repo tech-challenges-fiap/<repo> --branch prod --limit 5 --json databaseId,displayTitle,workflowName,status,conclusion,headBranch,event,createdAt,updatedAt,url
gh run view <run-id> --repo tech-challenges-fiap/<repo> --json name,conclusion,status,url,jobs
```

### Remote workflow list

| Repo | Remote workflows visible via `gh workflow list` |
|---|---|
| `workshop-app` | `Create Promotion PR`, `Drift Report`, `PR Validation`, `Promotion Source`, `Update Prod/Stag Badge` all active. Recent run history also references `Deploy`. |
| `workshop-billing` | No workflows listed. |
| `workshop-execution` | No workflows listed. |
| `workshop-edge` | `Create Promotion PR`, `Drift Report`, `PR Validation`, `Promotion Source`, `Update Prod/Stag Badge` all active. Recent run history also references `Deploy`. |
| `workshop-platform` | `Create Promotion PR`, `Drift Report`, `PR Validation`, `Promotion Source`, `Update Prod/Stag Badge` all active. Recent run history also references `Deploy`. |
| `workshop-db` | `PR Validation`, `Promotion Source`, `Drift Report`, `Create Promotion PR`, `Update Prod/Stag Badge` all active. Recent run history also references `Deploy`. |

### Green PR validation runs found

These are the strongest CI evidence links because they correspond to the protected required check names.

| Repo | Run | Conclusion | Jobs observed |
|---|---|---|---|
| `workshop-app` | https://github.com/tech-challenges-fiap/workshop-app/actions/runs/28380465166 | success | `lint`, `test`, `k8s`, `container`, `build` all success. |
| `workshop-edge` | https://github.com/tech-challenges-fiap/workshop-edge/actions/runs/28380471671 | success | `terraform`, `lambdas` success. |
| `workshop-platform` | https://github.com/tech-challenges-fiap/workshop-platform/actions/runs/28380477901 | success | `terraform`, `kubernetes` success. |
| `workshop-db` | https://github.com/tech-challenges-fiap/workshop-db/actions/runs/28380485369 | success | `terraform` success. |
| `workshop-billing` | none | missing | No remote workflows/runs were listed. |
| `workshop-execution` | none | missing | No remote workflows/runs were listed. |

### Recent branch run conclusions

| Repo | `stag` recent runs | `prod` recent runs | Conclusion |
|---|---|---|---|
| `workshop-app` | Latest `Deploy` on `stag` failed: https://github.com/tech-challenges-fiap/workshop-app/actions/runs/28379204658. Recent PR Validation runs are green, e.g. https://github.com/tech-challenges-fiap/workshop-app/actions/runs/28380465166. | Recent `Deploy` runs on `prod` succeeded, e.g. https://github.com/tech-challenges-fiap/workshop-app/actions/runs/26340719723 and https://github.com/tech-challenges-fiap/workshop-app/actions/runs/26340383553. | CI proof is good for PR checks; deploy proof is mixed because latest `stag` deploy failed. |
| `workshop-billing` | No runs. | No runs. | Missing remote CI/CD evidence. |
| `workshop-execution` | No runs. | No runs. | Missing remote CI/CD evidence, despite local `ci.yml`. |
| `workshop-edge` | Latest `stag` `Deploy` failed: https://github.com/tech-challenges-fiap/workshop-edge/actions/runs/28379208336. Recent PR Validation was green: https://github.com/tech-challenges-fiap/workshop-edge/actions/runs/28380471671. | Latest `prod` manual `Deploy` succeeded: https://github.com/tech-challenges-fiap/workshop-edge/actions/runs/26340780091, after earlier failures. | CI proof is good for PR checks; deploy proof is mixed. |
| `workshop-platform` | Latest `stag` `Deploy` failed: https://github.com/tech-challenges-fiap/workshop-platform/actions/runs/28379212117. Recent PR Validation was green: https://github.com/tech-challenges-fiap/workshop-platform/actions/runs/28380477901. | Recent `prod` deploy succeeded: https://github.com/tech-challenges-fiap/workshop-platform/actions/runs/26340890757. | CI proof is good for PR checks; deploy proof is mixed. |
| `workshop-db` | Latest `stag` `Deploy` failed: https://github.com/tech-challenges-fiap/workshop-db/actions/runs/28379215557. Recent PR Validation was green: https://github.com/tech-challenges-fiap/workshop-db/actions/runs/28380485369. | Recent `prod` deploy succeeded: https://github.com/tech-challenges-fiap/workshop-db/actions/runs/26340381251 and https://github.com/tech-challenges-fiap/workshop-db/actions/runs/25969631904. | CI proof is good for PR checks; deploy proof is mixed. |

## 4. Branch protection evidence

Commands used:

```bash
gh api -H 'Accept: application/vnd.github+json' repos/tech-challenges-fiap/<repo>/branches/<branch> --jq '{name,protected,protection_url,commit:.commit.sha}'
gh api -H 'Accept: application/vnd.github+json' repos/tech-challenges-fiap/<repo>/branches/<branch>/protection --jq '{required_status_checks, enforce_admins, required_pull_request_reviews, restrictions, required_linear_history, allow_force_pushes, allow_deletions, block_creations, required_conversation_resolution}'
```

Important interpretation note: `workshop-billing` and `workshop-execution` returned HTTP 404 `Branch not found` for every checked branch (`stag`, `prod`, `main`, `master`) and `gh api repos/<repo>/branches` returned `[]`. This is stronger than a permissions ambiguity: the authenticated token could read repo metadata, and the API reported no branches. It means no branch protection could be proven for those remote repos at collection time.

### Protection summary

| Repo | Branch | Branch API | Protected? | Required status checks | Other protection settings |
|---|---|---:|---:|---|---|
| `workshop-app` | `stag` | 200 | true | `lint`, `test`, `build`, `container`, `k8s`; `strict: true` | admins enforced; stale reviews dismissed; required conversation resolution; force pushes/deletions disabled. |
| `workshop-app` | `prod` | 200 | true | `lint`, `test`, `build`, `container`, `promotion-source`, `drift-report`, `k8s`; `strict: true` | admins enforced; stale reviews dismissed; required conversation resolution; force pushes/deletions disabled. |
| `workshop-billing` | `stag`/`prod`/`main`/`master` | 404 | not proven | none; branch not found | `gh api repos/tech-challenges-fiap/workshop-billing/branches` returned `[]`. |
| `workshop-execution` | `stag`/`prod`/`main`/`master` | 404 | not proven | none; branch not found | `gh api repos/tech-challenges-fiap/workshop-execution/branches` returned `[]`. |
| `workshop-edge` | `stag` | 200 | true | `terraform`, `lambdas`; `strict: true` | admins enforced; stale reviews dismissed; required conversation resolution; force pushes/deletions disabled. |
| `workshop-edge` | `prod` | 200 | true | `terraform`, `lambdas`, `promotion-source`, `drift-report`; `strict: true` | admins enforced; stale reviews dismissed; required conversation resolution; force pushes/deletions disabled. |
| `workshop-platform` | `stag` | 200 | true | `terraform`, `kubernetes`; `strict: true` | admins enforced; stale reviews dismissed; required conversation resolution; force pushes/deletions disabled. |
| `workshop-platform` | `prod` | 200 | true | `terraform`, `kubernetes`, `promotion-source`, `drift-report`; `strict: true` | admins enforced; stale reviews dismissed; required conversation resolution; force pushes/deletions disabled. |
| `workshop-db` | `stag` | 200 | true | `terraform`; `strict: true` | admins enforced; stale reviews dismissed; required conversation resolution; force pushes/deletions disabled. |
| `workshop-db` | `prod` | 200 | true | `terraform`, `promotion-source`, `drift-report`; `strict: true` | admins enforced; stale reviews dismissed; required conversation resolution; force pushes/deletions disabled. |

## 5. Gaps and risks

1. **Deploy workflows are not consistently green**: app, edge, platform, and db have recent green PR validation and green prod deploy evidence, but their latest `stag` deploy runs from 2026-06-29 failed.
2. **Billing and Execution were initialized, but GitHub Actions is blocked**: branches, workflows, and branch protection now exist for Billing and Execution, but their workflow runs currently end in `startup_failure` before creating jobs.
3. **GitHub platform instability is material**: GitHub Status at follow-up collection reported `API Requests: partial_outage` and `Actions: partial_outage`, matching repeated HTTP 503 responses from Actions/workflow/protection endpoints and run pages that failed to load.
4. **Phase 4 service CI remains incomplete until green Actions runs exist**: local validation passed for Billing and Execution, but checklist item 4 still needs remote green workflow evidence.

## 6. Follow-up correction attempt — Billing and Execution initialized

Collected: `2026-07-20T00:33:59Z`

After the initial evidence collection, the previously empty Billing and Execution remotes were initialized from the local service repositories.

### Remote initialization performed

| Repo | Branches published | Current `stag`/`prod` SHA | Notes |
|---|---|---|---|
| `workshop-billing` | `stag`, `prod` | `c85ec6606be2fb78e64786f49dc918f5bf4ae186` | Initial service commit plus simplified `.github/workflows/pr-validation.yml`. |
| `workshop-execution` | `stag`, `prod` | `ea67645e1b191be341f68c3d059a81d3379122f7` | Initial service commit plus simplified `.github/workflows/pr-validation.yml`; original local `.github/workflows/ci.yml` remains present. |

Local validation before publishing:

| Repo | Local validation result |
|---|---|
| `workshop-billing` | `bun install`, `bun run lint`, `bun test` (`36 pass, 0 fail`), `bun run build`, and `docker build -t workshop-billing:ci .` passed. |
| `workshop-execution` | `bun install`, `bun run lint`, `bun test` (`32 pass, 0 fail`), `bun run build`, and `docker build -t workshop-execution:ci .` passed. |

### Branch protection now applied

Read-back GitHub API evidence shows all four target branches are now protected:

| Repo | Branch | Protected? | Required check | Other enforced settings |
|---|---|---:|---|---|
| `workshop-billing` | `stag` | true | `ci`, strict | admins enforced; 1 approving review; stale reviews dismissed; conversation resolution required; force-push/deletion blocked. |
| `workshop-billing` | `prod` | true | `ci`, strict | admins enforced; 1 approving review; stale reviews dismissed; conversation resolution required; force-push/deletion blocked. |
| `workshop-execution` | `stag` | true | `ci`, strict | admins enforced; 1 approving review; stale reviews dismissed; conversation resolution required; force-push/deletion blocked. |
| `workshop-execution` | `prod` | true | `ci`, strict | admins enforced; 1 approving review; stale reviews dismissed; conversation resolution required; force-push/deletion blocked. |

### Remaining blocker: GitHub Actions startup failure during GitHub outage

The new workflows were pushed and GitHub created Actions run records, but every Billing/Execution run completed before job creation with `conclusion: startup_failure`, `path: BuildFailed`, and zero check-runs. The run pages also failed to load reliably.

Current failed run evidence:

| Repo | Branch | Run | Conclusion |
|---|---|---|---|
| `workshop-billing` | `stag` | https://github.com/tech-challenges-fiap/workshop-billing/actions/runs/29709523446 | `startup_failure` |
| `workshop-billing` | `prod` | https://github.com/tech-challenges-fiap/workshop-billing/actions/runs/29709563785 | `startup_failure` |
| `workshop-execution` | `stag` | https://github.com/tech-challenges-fiap/workshop-execution/actions/runs/29709553400 | `startup_failure` |
| `workshop-execution` | `prod` | https://github.com/tech-challenges-fiap/workshop-execution/actions/runs/29709526577 | `startup_failure` |

GitHub status API at collection time reported:

```text
overall: Minor Service Outage
API Requests: partial_outage
Actions: partial_outage
```

## 7. Retry note — GitHub Actions/API still unavailable

Collected: `2026-07-20T01:16:39Z`

Read-only retry for Billing and Execution CI evidence. GitHub CLI authentication still worked with the expected `repo` and `workflow` scopes (token redacted). Branch read-back still proves `stag` and `prod` exist and are protected with required `ci` for both repositories:

| Repo | Branches | SHA | Protection state |
|---|---|---|---|
| `workshop-billing` | `stag`, `prod` | `c85ec6606be2fb78e64786f49dc918f5bf4ae186` | protected; required status check `ci` |
| `workshop-execution` | `stag`, `prod` | `ea67645e1b191be341f68c3d059a81d3379122f7` | protected; required status check `ci` |

Workflow dispatch retry against `pr-validation.yml` on `stag` did **not** create new usable evidence because GitHub returned HTTP 503 for Actions workflow API calls:

- Billing dispatch: HTTP 503 reading `actions/workflows/pr-validation.yml`.
- Execution dispatch: HTTP 503 creating workflow dispatch event for workflow id `316388080`.

Polling from `2026-07-20T01:09:33Z` through `2026-07-20T01:15:53Z` alternated between HTTP 503 responses and the same existing completed `startup_failure` push runs; no green `ci` job/check was observed:

| Repo | Latest accessible `stag` run | Status/conclusion | Notes |
|---|---|---|---|
| `workshop-billing` | https://github.com/tech-challenges-fiap/workshop-billing/actions/runs/29709523446 | completed / `startup_failure` | Push run at target SHA; no successful `ci` job evidence. |
| `workshop-execution` | https://github.com/tech-challenges-fiap/workshop-execution/actions/runs/29709553400 | completed / `startup_failure` | Push run at target SHA; no successful `ci` job evidence. |

GitHub Status at retry time:

```text
overall: Minor Service Outage
API Requests: partial_outage
Actions: partial_outage
incidents: Disruption with some GitHub services: investigating; Incident with GitHub Actions: investigating
```

Checklist item 4 remains **Partial**. Do not mark `/var/www/jogo/plano-fase4-tech-challenge.html` item 4 complete until Billing and Execution have successful remote Actions evidence.

## 8. Retry note — dispatch created runs, but Actions still failed before jobs

Collected: `2026-07-20T01:53:50Z`

GitHub Status at retry time still reported `overall: Minor Service Outage`, with `API Requests: partial_outage` and `Actions: partial_outage`. GitHub CLI authentication still worked with `repo` and `workflow` scopes (token redacted).

Branch/protection read-back remained valid for both target repositories:

| Repo | Branches | SHA | Protection state |
|---|---|---|---|
| `workshop-billing` | `stag`, `prod` | `c85ec6606be2fb78e64786f49dc918f5bf4ae186` | protected; required status check `ci`; strict mode true |
| `workshop-execution` | `stag`, `prod` | `ea67645e1b191be341f68c3d059a81d3379122f7` | protected; required status check `ci`; strict mode true |

Workflow dispatch was retried against `PR Validation` / `pr-validation.yml` on `stag`. Billing first returned HTTP 500 for workflow id `316386698`, then a fallback dispatch created a run; Execution dispatch also created a run. After polling until completion, both runs still ended with `startup_failure` before creating jobs/checks, so no green `ci` evidence exists yet:

| Repo | Latest dispatched `stag` run | Status/conclusion | Jobs observed |
|---|---|---|---|
| `workshop-billing` | https://github.com/tech-challenges-fiap/workshop-billing/actions/runs/29711474504 | completed / `startup_failure` | none (`jobs: []`) |
| `workshop-execution` | https://github.com/tech-challenges-fiap/workshop-execution/actions/runs/29711476120 | completed / `startup_failure` | none (`jobs: []`) |

Checklist item 4 remains **Partial**. Do not mark `/var/www/jogo/plano-fase4-tech-challenge.html` item 4 complete until Billing and Execution have completed successful remote Actions evidence for `ci` / `PR Validation`.

## 9. Retry note — dispatch accepted, runs still queued during Actions outage

Collected: `2026-07-20T02:36:07Z`

GitHub Status at retry time still reported `overall: Minor Service Outage`; `API Requests: degraded_performance`; `Actions: partial_outage`; incident `Incident with GitHub Actions` remained `investigating`. GitHub CLI authentication still worked with `repo` and `workflow` scopes (token redacted).

Branch/protection read-back remained valid for both target repositories:

| Repo | Branches | SHA | Protection state |
|---|---|---|---|
| `workshop-billing` | `stag`, `prod` | `c85ec6606be2fb78e64786f49dc918f5bf4ae186` | protected; required status check `ci`; strict mode true |
| `workshop-execution` | `stag`, `prod` | `ea67645e1b191be341f68c3d059a81d3379122f7` | protected; required status check `ci`; strict mode true |

Workflow dispatch was retried against `PR Validation` / `pr-validation.yml` on `stag` for both repositories and GitHub accepted both dispatches. After polling until the cron run budget expired, both latest dispatch runs remained queued; no completed successful `ci` / `PR Validation` evidence exists yet:

| Repo | Latest dispatched `stag` run | Status/conclusion | Notes |
|---|---|---|---|
| `workshop-billing` | https://github.com/tech-challenges-fiap/workshop-billing/actions/runs/29712566371 | queued / none | Dispatch accepted at `2026-07-20T02:25:36Z`; still queued at final read-back. Previous runs remain `startup_failure`. |
| `workshop-execution` | https://github.com/tech-challenges-fiap/workshop-execution/actions/runs/29712567395 | queued / none | Dispatch accepted at `2026-07-20T02:25:38Z`; still queued at final read-back. Previous runs remain `startup_failure`. |

Checklist item 4 remains **Partial**. Do not mark `/var/www/jogo/plano-fase4-tech-challenge.html` item 4 complete until Billing and Execution have completed successful remote Actions evidence for `ci` / `PR Validation`.

## 10. Conclusion for final checklist item 4

Status: **Partial**.

Evidence is sufficient to prove independent CI and branch protection for:

- `workshop-app`
- `workshop-edge`
- `workshop-platform`
- `workshop-db`

Evidence is now sufficient to prove remote branches, workflow files, and branch protection for:

- `workshop-billing`
- `workshop-execution`

Evidence is still not sufficient to prove green remote Actions runs for:

- `workshop-billing`
- `workshop-execution`

Recommended next actions before marking `/var/www` checklist item 4 complete:

1. Retry or dispatch Billing and Execution `PR Validation` after GitHub Actions/API recovers.
2. Collect green `ci` workflow links for Billing and Execution.
3. Investigate/fix or clearly caveat the latest failed `stag` Deploy runs in app/edge/platform/db if deploy success is required by the evaluator, not only PR validation success.

## 11. Retry note — dispatch accepted, `ci` jobs still queued during Actions outage

Collected: `2026-07-20T03:18:11Z`

GitHub Status at retry time reported `overall: Minor Service Outage`; `API Requests: operational`; `Actions: partial_outage`; incident `Incident with GitHub Actions` remained `investigating`. GitHub CLI authentication still worked with `repo` and `workflow` scopes (token redacted).

Branch/protection read-back remained valid for both target repositories:

| Repo | Branches | SHA | Protection state |
|---|---|---|---|
| `workshop-billing` | `stag`, `prod` | `c85ec6606be2fb78e64786f49dc918f5bf4ae186` | protected; required status check `ci`; strict mode true |
| `workshop-execution` | `stag`, `prod` | `ea67645e1b191be341f68c3d059a81d3379122f7` | protected; required status check `ci`; strict mode true |

Workflow dispatch was retried against `PR Validation` / `pr-validation.yml` on `stag` for both repositories and GitHub accepted both dispatches. After polling until the cron run budget expired, both latest dispatch runs remained queued. Unlike earlier startup-failure attempts, `gh run view` now shows a queued job named `ci` for each run, but neither has completed successfully yet:

| Repo | Latest dispatched `stag` run | Status/conclusion | Job evidence observed |
|---|---|---|---|
| `workshop-billing` | https://github.com/tech-challenges-fiap/workshop-billing/actions/runs/29713968100 | queued / none | job `ci` queued: https://github.com/tech-challenges-fiap/workshop-billing/actions/runs/29713968100/job/88263139797 |
| `workshop-execution` | https://github.com/tech-challenges-fiap/workshop-execution/actions/runs/29713969857 | queued / none | job `ci` queued: https://github.com/tech-challenges-fiap/workshop-execution/actions/runs/29713969857/job/88263145134 |

Previous accessible `stag` dispatch runs from `2026-07-20T02:25Z` also remained queued during this retry:

- Billing: https://github.com/tech-challenges-fiap/workshop-billing/actions/runs/29712566371
- Execution: https://github.com/tech-challenges-fiap/workshop-execution/actions/runs/29712567395

Checklist item 4 remains **Partial**. Do not mark `/var/www/jogo/plano-fase4-tech-challenge.html` item 4 complete until Billing and Execution have completed successful remote Actions evidence for `ci` / `PR Validation`.

## 12. Final retry — Billing and Execution `ci` jobs completed successfully

Collected: `2026-07-20T03:51:58Z`

GitHub Status at retry time reported `overall: All Systems Operational`, with `API Requests: operational` and `Actions: operational`. GitHub CLI authentication still worked with the expected `repo` and `workflow` scopes (token redacted).

Branch/protection read-back remained valid for both target repositories:

| Repo | Branches | SHA | Protection state |
|---|---|---|---|
| `workshop-billing` | `stag`, `prod` | `c85ec6606be2fb78e64786f49dc918f5bf4ae186` | protected; required status check `ci`; strict mode true |
| `workshop-execution` | `stag`, `prod` | `ea67645e1b191be341f68c3d059a81d3379122f7` | protected; required status check `ci`; strict mode true |

The latest dispatched `PR Validation` runs on `stag` completed successfully, each with a successful job named `ci`:

| Repo | Successful `stag` run | Workflow / event | Job evidence |
|---|---|---|---|
| `workshop-billing` | https://github.com/tech-challenges-fiap/workshop-billing/actions/runs/29713968100 | `PR Validation` / `workflow_dispatch`; completed `success`; head SHA `c85ec6606be2fb78e64786f49dc918f5bf4ae186` | job `ci` completed `success`: https://github.com/tech-challenges-fiap/workshop-billing/actions/runs/29713968100/job/88263139797 |
| `workshop-execution` | https://github.com/tech-challenges-fiap/workshop-execution/actions/runs/29713969857 | `PR Validation` / `workflow_dispatch`; completed `success`; head SHA `ea67645e1b191be341f68c3d059a81d3379122f7` | job `ci` completed `success`: https://github.com/tech-challenges-fiap/workshop-execution/actions/runs/29713969857/job/88263145134 |

Final checklist item 4 status: **Complete**. Remote GitHub Actions evidence now proves green Billing and Execution CI, and GitHub API read-back proves branch protection for `stag` and `prod` with required `ci` checks in both repositories.
