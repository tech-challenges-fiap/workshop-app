# RFC-002 — Estratégia de Autenticação via CPF + JWT

| Campo | Valor |
|---|---|
| **Número** | RFC-002 |
| **Status** | Aceito |
| **Data** | 2026-05-17 |
| **Repositório** | workshop-app |

---

## Contexto

O `workshop-app` expõe rotas sensíveis que manipulam ordens de serviço, pessoas, veículos e estoque. O acesso a essas rotas precisa ser restrito a usuários autenticados (atendentes, mecânicos, administradores).

Requisitos levantados:

- **Sem senha:** o sistema não quer gerenciar senhas de usuários. A identidade é baseada no CPF, um identificador nacional único no Brasil.
- **Stateless:** a arquitetura é baseada em Kubernetes com múltiplas réplicas; sessões mantidas em memória por instância não são viáveis.
- **Integração com API Gateway:** a autenticação precisa ocorrer antes de o tráfego chegar ao `workshop-app`, aproveitando o API Gateway como ponto de controle centralizado.
- **Separação de responsabilidades:** o `workshop-app` não deve emitir tokens; deve apenas validar tokens emitidos por uma autoridade confiável.
- **Roles diferenciados:** o sistema distingue `adminAuthMiddleware` (atendentes/admin, rotas `/stock-items/*`, `/services/*`, `/vehicles/*`, `/person/*`, `/work-orders/*`) de `mechanicAuthMiddleware` (mecânicos, rotas `/service-tasks/*`).

---

## Proposta

Adotar o fluxo: **CPF → Lambda `auth-cpf` → JWT HS256 → validação no `workshop-app`**.

### Fluxo detalhado

1. O cliente envia o CPF para o API Gateway.
2. O API Gateway invoca a Lambda `auth-cpf` (componente do `workshop-edge`).
3. A Lambda consulta o banco de dados para verificar se o CPF pertence a uma `person` com `status = "active"`.
4. A Lambda emite um JWT assinado com HS256 usando `JWT_SECRET` compartilhado.
5. O JWT contém os claims: `sub`, `person_id`, `cpf` (hash), `role`, `status`, `iss=workshop-edge`, `aud=workshop-app`, `exp`, `iat`, `jti`.
6. O cliente usa o JWT como `Bearer` token nas requisições subsequentes ao API Gateway.
7. O `workshop-app` valida o JWT em cada request protegido:
   - Assinatura HS256 com `JWT_SECRET`
   - `iss` deve ser `workshop-edge`
   - `aud` deve ser `workshop-app`
   - Token não expirado (`exp`) e não futuro (`iat`)
   - Claims obrigatórios presentes
   - `status = "active"` — caso contrário, retorna 403

O `workshop-app` não emite tokens e não possui endpoint de login próprio.

---

## Alternativas Consideradas

### OAuth2 / OpenID Connect

OAuth2 com um Identity Provider (IdP) dedicado (Cognito, Auth0, Keycloak) oferece o padrão da indústria para autenticação federada, suporte a múltiplos fatores e revogação de tokens. No entanto, para um sistema interno de oficina com identidade baseada em CPF, a complexidade de configurar e manter um IdP supera os benefícios no escopo do MVP. O fluxo CPF → JWT é mais simples e direto para o caso de uso.

### API Key

API Keys são simples de implementar mas não carregam informações de identidade (role, person_id) sem uma consulta adicional ao banco. Revogar uma API key comprometida exige coordenação entre serviços. O JWT é preferível por ser autocontido e verificável sem estado compartilhado.

### Autenticação baseada em sessão (session-based)

Sessões armazenadas em banco ou Redis introduzem estado compartilhado entre réplicas do `workshop-app`. Com HPA escalando entre 1 e 3 réplicas, isso exigiria sticky sessions ou um session store centralizado. JWTs stateless eliminam essa necessidade.

---

## Trade-offs

| Critério | CPF + Lambda + JWT | OAuth2/OIDC | API Key | Session |
|---|---|---|---|---|
| Complexidade de implementação | Baixa | Alta | Baixa | Média |
| Carrega identidade no token | Sim (claims) | Sim (claims OIDC) | Não | Não (requer lookup) |
| Stateless (multi-réplica) | Sim | Sim | Sim | Não |
| Revogação imediata | Não (até expiração) | Sim (introspection) | Sim | Sim |
| Integração com API Gateway Lambda | Nativa | Requer configuração | Requer configuração | Não aplicável |
| Padrão indústria | Parcial | Total | Parcial | Parcial |
| Adequação ao MVP | Alta | Baixa | Média | Baixa |

O principal trade-off desta estratégia é a **ausência de revogação imediata de tokens**. Um token JWT emitido permanece válido até sua expiração (`exp`), mesmo que o `status` da `person` mude para `blocked` no banco. Esse risco é mitigado por: (a) curto período de expiração configurável no token, e (b) o claim `status` embutido no JWT é verificado pelo middleware — mas reflete o status no momento da emissão, não o atual.

---

## Decisão

A estratégia CPF + Lambda `auth-cpf` + JWT HS256 é adotada para autenticação do `workshop-app`. A decisão é justificada por:

1. **Simplicidade operacional** adequada ao escopo do MVP e ao Tech Challenge Fase 3 (FIAP SOAT).
2. **Separação de responsabilidades** clara: `workshop-edge` emite tokens, `workshop-app` apenas valida.
3. **Stateless por design**, compatível com escalabilidade horizontal via HPA.
4. **Integração nativa** com AWS API Gateway e Lambda, sem dependência de IdP externo.

O risco de revogação tardia é aceito como trade-off do MVP. Em evolução futura, pode-se adotar uma lista negra de `jti` em Redis ou migrar para OAuth2 com introspection endpoint.
