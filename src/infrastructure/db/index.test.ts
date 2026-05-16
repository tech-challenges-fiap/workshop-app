import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { buildDatabaseUrl, ensureDatabaseConnection } from "./index";

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_ARGV = [...process.argv];

describe("buildDatabaseUrl", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.argv = [ORIGINAL_ARGV[0] ?? "bun", "src/main.ts"];
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.argv = [...ORIGINAL_ARGV];
  });

  it("uses DATABASE_URL_TEST in test env when defined", () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL_TEST = "postgresql://user:pass@test-host:5432/test_db";

    const url = buildDatabaseUrl();

    expect(url).toBe("postgresql://user:pass@test-host:5432/test_db");
  });

  it("builds test URL from POSTGRES_* vars when DATABASE_URL_TEST is missing", () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL_TEST;
    process.env.POSTGRES_USER = "u";
    process.env.POSTGRES_PASSWORD = "p";
    process.env.POSTGRES_HOST = "h";
    process.env.POSTGRES_PORT = "1234";
    process.env.POSTGRES_DB_TEST = "db_test";

    const url = buildDatabaseUrl();

    expect(url).toBe("postgresql://u:p@h:1234/db_test");
  });

  it("uses DATABASE_URL in non-test env when defined", () => {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgresql://main-user:pass@host:5432/main_db";

    const url = buildDatabaseUrl();

    expect(url).toBe("postgresql://main-user:pass@host:5432/main_db");
  });

  it("builds non-test URL from POSTGRES_* vars when DATABASE_URL is missing", () => {
    process.env.NODE_ENV = "development";
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_USER = "main";
    process.env.POSTGRES_PASSWORD = "pw";
    process.env.POSTGRES_HOST = "db-host";
    process.env.POSTGRES_PORT = "6543";
    process.env.POSTGRES_DB = "workshop_db";

    const url = buildDatabaseUrl();

    expect(url).toBe("postgresql://main:pw@db-host:6543/workshop_db");
  });

  it("encodes generated URL credentials when POSTGRES_PASSWORD has special characters", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_USER = "workshop_admin";
    process.env.POSTGRES_PASSWORD = "p@ss:word/with?#special";
    process.env.POSTGRES_HOST = "db-host";
    process.env.POSTGRES_PORT = "5432";
    process.env.POSTGRES_DB = "workshop";

    const url = buildDatabaseUrl();

    expect(url).toContain("workshop_admin");
    expect(url).toContain(encodeURIComponent("p@ss:word/with?#special"));
    expect(url).toContain("db-host:5432");
    expect(url.endsWith("/workshop")).toBe(true);
  });

  it("treats bun test runner argv as test env", () => {
    process.env.NODE_ENV = "production";
    delete process.env.DATABASE_URL_TEST;
    process.env.POSTGRES_USER = "u";
    process.env.POSTGRES_PASSWORD = "p";
    process.env.POSTGRES_HOST = "h";
    process.env.POSTGRES_PORT = "1234";
    process.env.POSTGRES_DB_TEST = "db_test";
    process.argv = [ORIGINAL_ARGV[0] ?? "bun", "src/integration/work-order-flow.test.ts"];

    const url = buildDatabaseUrl();

    expect(url).toBe("postgresql://u:p@h:1234/db_test");
  });
});

describe("ensureDatabaseConnection", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "test" };
    process.argv = [ORIGINAL_ARGV[0] ?? "bun", "src/infrastructure/db/index.test.ts"];
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.argv = [...ORIGINAL_ARGV];
  });

  it("returns immediately on second call once connected", async () => {
    await ensureDatabaseConnection();
    await ensureDatabaseConnection();
  });
});
