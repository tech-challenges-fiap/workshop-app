#!/usr/bin/env bash
set -euo pipefail

BASE_BRANCH="${BASE_BRANCH:-prod}"
HEAD_BRANCH="${HEAD_BRANCH:-stag}"
TITLE="${TITLE:-promote: ${HEAD_BRANCH} to ${BASE_BRANCH}}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required." >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required." >&2
  exit 1
fi

existing_pr="$(
  gh pr list \
    --base "${BASE_BRANCH}" \
    --head "${HEAD_BRANCH}" \
    --state open \
    --json url \
    --jq '.[0].url // ""'
)"

if [ -n "${existing_pr}" ]; then
  echo "Promotion PR already exists: ${existing_pr}"
  exit 0
fi

git fetch origin "${BASE_BRANCH}" "${HEAD_BRANCH}" --no-tags

if git diff --quiet "origin/${BASE_BRANCH}..origin/${HEAD_BRANCH}"; then
  echo "No differences between ${HEAD_BRANCH} and ${BASE_BRANCH}; promotion PR not created."
  exit 0
fi

body_file="$(mktemp)"
trap 'rm -f "${body_file}"' EXIT

cat > "${body_file}" <<EOF
Promotes the current \`${HEAD_BRANCH}\` branch to \`${BASE_BRANCH}\`.

After this PR is merged, the \`Deploy\` workflow applies the production environment.
EOF

if ! gh pr create \
  --base "${BASE_BRANCH}" \
  --head "${HEAD_BRANCH}" \
  --title "${TITLE}" \
  --body-file "${body_file}"; then
  echo "Failed to create promotion PR. Check that PROMOTION_PR_TOKEN can create pull requests in this repository." >&2
  exit 1
fi
