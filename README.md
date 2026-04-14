# workshop-app

API principal do projeto `workshop`.

## Proposito

Este repositorio concentra a aplicacao principal, incluindo regra de negocio,
schema evolutivo, migrations, seeds e deploy do container da API.

## Stack principal

- Bun
- TypeScript
- Docker
- AWS

## Estrategia de deploy

- `feature/* -> stag`: Pull Request com lint, testes, build e imagem de container
- `stag -> prod`: Pull Request de promocao para `production`
- deploy via pipeline com autenticacao AWS por OIDC

## Documentacao local

- [docs/README.md](docs/README.md)

