# ADR-001 — Padrão de Comunicação Síncrono REST

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-05-17 |
| **Repositório** | workshop-app |

---

## Contexto

O `workshop-app` precisa expor suas funcionalidades (gestão de Work Orders, Service Tasks, estoque, pessoas, veículos) para clientes externos (atendentes, mecânicos, administradores) e receber eventos externos via webhook.

A equipe avaliou os seguintes padrões de comunicação:

- **REST HTTP/JSON:** padrão amplamente adotado, baseado em verbos HTTP e recursos. Bem suportado por ferramentas de documentação (OpenAPI/Swagger), testes e monitoramento.
- **gRPC:** protocolo binário baseado em Protocol Buffers, eficiente em latência e throughput. Exige geração de código e suporte específico em clientes e gateways.
- **GraphQL:** permite que clientes especifiquem exatamente os dados que precisam. Introduz complexidade operacional (resolvers, N+1, cache HTTP) não justificada para um domínio CRUD orientado a ordens de serviço.
- **Event-driven (mensageria):** comunicação assíncrona via filas ou tópicos (ex: SQS, Kafka). Adequado para desacoplamento de serviços, mas adiciona complexidade operacional e dificulta rastreabilidade de transações síncronas (ex: aprovação de ServiceTask pelo cliente).

O framework escolhido para o HTTP layer é **Hono**, um framework minimalista e de alta performance para Bun/TypeScript, com suporte nativo a middlewares, roteamento e validação.

---

## Decisão

Adotar **REST HTTP/JSON** como padrão exclusivo de comunicação síncrona, implementado via **Hono** sobre **Bun**.

As rotas expostas pela aplicação são:

| Rota | Middleware de Auth | Domínio |
|---|---|---|
| `GET /health` | Nenhum | Observabilidade |
| `GET /ready` | Nenhum | Observabilidade |
| `GET /docs`, `GET /openapi.yaml` | Nenhum | Documentação |
| `/stock-items/*` | adminAuthMiddleware | Estoque |
| `/services/*` | adminAuthMiddleware | Catálogo |
| `/service-tasks/*` | mechanicAuthMiddleware | Tarefas de Serviço |
| `/vehicles/*` | adminAuthMiddleware | Veículos |
| `/person/*` | adminAuthMiddleware | Pessoas |
| `/work-orders/*` | adminAuthMiddleware | Ordens de Serviço |
| `/webhooks/work-order-events` | Nenhum (autenticação própria) | Integração externa |

O contrato HTTP é documentado no arquivo `docs/openapi.yaml` e exposto em runtime via `/openapi.yaml` e `/docs` (Swagger UI).

---

## Consequências

### Positivas

- **Simplicidade:** REST é o padrão mais familiar para a equipe e para ferramentas de teste (curl, Postman, OWASP ZAP).
- **Compatibilidade com API Gateway:** o AWS API Gateway tem suporte nativo a rotas HTTP REST, incluindo integração com Lambda para autenticação.
- **Documentação automática:** o contrato OpenAPI (`docs/openapi.yaml`) pode ser gerado e validado em CI, e serve como entrada para ferramentas DAST (OWASP ZAP).
- **Monitoramento simplificado:** logs por request com método, rota, status HTTP e duração são suficientes para observabilidade básica; não há multiplexação de streams.

### Negativas

- **Overhead por request:** cada requisição HTTP carrega headers completos. Em cenários de alta frequência (ex: polling de status de OS), isso é menos eficiente que gRPC ou WebSockets.
- **Sem streaming:** o padrão REST/JSON não suporta streaming de eventos em tempo real. Notificações de mudança de status de Work Order são feitas via polling ou webhook externo (já previsto na rota `/webhooks/work-order-events`).
- **Sem tipagem binária:** JSON é verboso em relação a Protocol Buffers. Para o volume de dados do MVP (ordens de serviço de uma oficina), isso não representa gargalo.

### Neutras

- A escolha de REST não impede evolução futura para event-driven em contextos específicos (ex: notificações assíncronas já são implementadas via adaptador Beeceptor/no-op, desacopladas do fluxo HTTP principal).
- O uso de Hono permite troca de runtime (Bun → Node.js, Cloudflare Workers) sem alteração do código de rotas.
