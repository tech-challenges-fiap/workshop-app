# workshop-app docs

## Ownership

- escopo: API principal, schema evolutivo, migrations, seeds e logica de negocio
- fora do escopo: API Gateway, Lambdas do edge e provisionamento do banco

## Estrutura inicial

- `src/`: codigo da API Bun
- `test/`: testes automatizados
- `scripts/`: automacoes locais e de CI
- `.github/`: ownership, templates e workflows

## Ambientes

- branch `stag` mapeada para GitHub environment `staging`
- branch `prod` mapeada para GitHub environment `production`
- naming AWS com sufixos `stag` e `prod`

## Variaveis e secrets esperados por ambiente

- `AWS_REGION`
- `AWS_ROLE_ARN`
- `ECR_REPOSITORY`
- `APP_BASE_URL`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `DATADOG_API_KEY`
- `DATADOG_APP_KEY`

