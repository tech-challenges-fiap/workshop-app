FROM oven/bun:1.3.6 AS deps

WORKDIR /app

# Install full dependency graph once and reuse in dev/build stages.
COPY package.json bun.lock tsconfig.json tsconfig.build.json eslint.config.cjs .prettierrc .prettierignore ./
RUN bun install --frozen-lockfile

FROM deps AS dev

COPY src ./src
COPY docs ./docs

ENV NODE_ENV=development
EXPOSE 3000

# Dev target keeps source-based execution for local compose workflows.
CMD ["sh", "-c", "bun run src/infrastructure/db/migrate.ts && bun run src/infrastructure/db/seed.ts && bun run src/main.ts"]

FROM deps AS build

COPY src ./src
COPY scripts ./scripts
RUN bun run build \
  && mkdir -p dist/src/infrastructure/db \
  && cp -R src/infrastructure/db/migrations dist/src/infrastructure/db/migrations \
  && cp -R src/infrastructure/db/seeds dist/src/infrastructure/db/seeds

FROM oven/bun:1.3.6 AS prod-deps

WORKDIR /app
COPY package.json bun.lock ./
COPY --from=deps /app/bun.lock ./bun.lock
RUN bun install --production --frozen-lockfile

FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY docs/openapi.yaml ./docs/openapi.yaml
COPY package.json ./

EXPOSE 3000

# Runtime stage starts the application only. Migrations run as a controlled Kubernetes Job.
CMD ["node", "dist/src/main.js"]
