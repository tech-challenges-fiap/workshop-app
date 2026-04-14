# workshop-app docs

## Ownership

- scope: main API, evolutionary schema, migrations, seeds, and business logic
- out of scope: API Gateway, edge Lambdas, and database provisioning

## Initial structure

- `src/`: Bun API source code
- `test/`: automated tests
- `scripts/`: local and CI automation
- `.github/`: ownership, templates e workflows

## Environments

- branch `stag` maps to GitHub environment `staging`
- branch `prod` maps to GitHub environment `production`
- AWS naming uses `stag` and `prod` suffixes

## Expected environment variables and secrets

- `AWS_REGION`
- `AWS_ROLE_ARN`
- `ECR_REPOSITORY`
- `APP_BASE_URL`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `DATADOG_API_KEY`
- `DATADOG_APP_KEY`
