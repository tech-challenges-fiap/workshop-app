import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

function readFileFromRoot(relativePath: string): string {
  const fileUrl = new URL(`../../${relativePath}`, import.meta.url);
  return readFileSync(fileUrl, "utf8").replace(/\r\n/g, "\n");
}

function extractSection(content: string, startMarker: string, endMarker?: string): string {
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) {
    throw new Error(`Start marker not found: ${startMarker}`);
  }

  if (!endMarker) {
    return content.slice(startIndex);
  }

  const endIndex = content.indexOf(endMarker, startIndex + startMarker.length);
  if (endIndex === -1) {
    throw new Error(`End marker not found: ${endMarker}`);
  }

  return content.slice(startIndex, endIndex);
}

describe("Runtime operability contract", () => {
  it("defines compose healthchecks and health-gated startup ordering", () => {
    const compose = readFileFromRoot("docker-compose.yml");

    const appSection = extractSection(compose, "  app:\n", "\n  postgres:\n");
    expect(appSection).toContain("depends_on:");
    expect(appSection).toContain("postgres:");
    expect(appSection).toContain("condition: service_healthy");
    expect(appSection).toContain("healthcheck:");
    expect(appSection).toContain("http://127.0.0.1:3000/health");
    expect(appSection).toContain("interval: 10s");
    expect(appSection).toContain("timeout: 5s");
    expect(appSection).toContain("retries: 5");

    const postgresSection = extractSection(compose, "  postgres:\n", "\n  nginx:\n");
    expect(postgresSection).toContain("healthcheck:");
    expect(postgresSection).toContain("pg_isready");
    expect(postgresSection).toContain("POSTGRES_USER");
    expect(postgresSection).toContain("POSTGRES_DB");

    const nginxSection = extractSection(compose, "  nginx:\n", "\nnetworks:\n");
    expect(nginxSection).toContain("depends_on:");
    expect(nginxSection).toContain("app:");
    expect(nginxSection).toContain("condition: service_healthy");
  });

  it("defines a multi-stage Dockerfile with lean compiled runtime", () => {
    const dockerfile = readFileFromRoot("Dockerfile");
    const migrationJob = readFileFromRoot("k8s/base/migration-job.yaml");
    const runtimeSection = extractSection(dockerfile, "FROM node:22-slim AS runtime\n");

    expect(dockerfile).toContain("FROM oven/bun:1.3.6 AS deps");
    expect(dockerfile).toContain("FROM deps AS build");
    expect(dockerfile).toContain("FROM oven/bun:1.3.6 AS prod-deps");
    expect(dockerfile).toContain("COPY --from=build /app/dist ./dist");
    expect(dockerfile).toContain("bun install --production");

    expect(runtimeSection).toContain("ENV NODE_ENV=production");
    expect(runtimeSection).toContain("dist/src/main.js");
    expect(runtimeSection).not.toContain("dist/src/infrastructure/db/migrate.js");
    expect(runtimeSection).not.toContain("dist/src/infrastructure/db/seed.js");
    expect(runtimeSection).not.toContain("src/main.ts");

    expect(migrationJob).toContain("kind: Job");
    expect(migrationJob).toContain("dist/src/infrastructure/db/migrate.js");
  });
});
