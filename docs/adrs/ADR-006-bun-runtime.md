# ADR-006 — Uso de Bun como Runtime Oficial

| Campo | Valor |
|---|---|
| **Status** | Aceito |
| **Data** | 2026-05-23 |
| **Repositório** | workshop-app |

---

## Contexto

O `workshop-app` é implementado em TypeScript com uma arquitetura hexagonal (ports & adapters). O runtime de execução precisa suportar TypeScript nativamente ou com transpilação mínima, gerenciamento de pacotes e execução de testes.

A equipe avaliou três runtimes:

- **Node.js (v20+):** runtime mais maduro e amplamente adotado. Requer transpilação de TypeScript (via `tsc`, `tsx` ou `ts-node`). Ecosistema imenso de pacotes. Performance HTTP competitiva com frameworks modernos.
- **Deno:** runtime com suporte nativo a TypeScript, sistema de permissões e módulos via URL. Compatibilidade com pacotes npm melhorou significativamente, mas ainda há gaps em bibliotecas específicas (ex: drivers de banco, ORMs maduros como Drizzle).
- **Bun:** runtime com suporte nativo a TypeScript, bundler integrado, test runner integrado e gerenciador de pacotes ultra-rápido. Compatível com a maioria dos pacotes npm. Performance HTTP superior ao Node.js em benchmarks sintéticos.

---

## Decisão

Adotar **Bun** como runtime oficial para o `workshop-app`.

### Justificativas

1. **TypeScript nativo:** executa `.ts` diretamente sem etapa de transpilação, simplificando o pipeline de build e desenvolvimento local.
2. **Performance:** HTTP throughput superior ao Node.js para handlers síncronos e I/O-bound (relevante para endpoints CRUD).
3. **Toolchain unificado:** `bun install` (package manager), `bun test` (test runner) e `bun run` (script runner) em um único binário.
4. **Compatibilidade npm:** Drizzle ORM, Hono, dd-trace e demais dependências funcionam sem adaptação.
5. **Build de produção otimizado:** `bun build` gera um bundle standalone para o container Docker, reduzindo o tamanho da imagem.

### Dockerfile

```dockerfile
FROM oven/bun:1-slim AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY . .
RUN bun run build
CMD ["bun", "run", "dist/main.js"]
```

### Compatibilidade

| Dependência | Compatível com Bun? |
|---|---|
| Hono (HTTP framework) | ✅ |
| Drizzle ORM | ✅ |
| dd-trace (Datadog APM) | ✅ |
| zod (validação) | ✅ |
| jose (JWT) | ✅ |

---

## Consequências

### Positivas

- **DX (Developer Experience):** sem configuração de `tsconfig` para runtime, sem `ts-node`/`tsx` para desenvolvimento. `bun run src/main.ts` funciona diretamente.
- **CI mais rápido:** `bun install` é significativamente mais rápido que `npm install` (~3-5x), reduzindo tempo de pipeline.
- **Imagem Docker menor:** bundle standalone elimina `node_modules` da imagem final.
- **Testes integrados:** `bun test` com suporte a mocks, matchers e watch mode sem dependências externas (Jest, Vitest).

### Negativas

- **Maturidade:** Bun é mais recente que Node.js; bugs edge-case podem aparecer em cenários menos testados pela comunidade.
- **Ecosistema de debugging:** ferramentas de profiling e debugging são menos maduras que o ecossistema Node.js (Chrome DevTools, `--inspect`).
- **Lock-in de runtime:** se Bun for descontinuado, seria necessário migrar para Node.js (baixo risco dado a compatibilidade npm, mas requer ajustes no Dockerfile e scripts).
