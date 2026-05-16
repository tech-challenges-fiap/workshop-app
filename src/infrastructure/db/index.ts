import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const TEST_FILE_ARG_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/i;

function isTestRunnerArg(value: string): boolean {
  return TEST_FILE_ARG_PATTERN.test(value.toLowerCase());
}

function isTestEnv(): boolean {
  if (process.env.NODE_ENV === "test") {
    return true;
  }

  // Fallback for direct test-file execution.
  return process.argv.some(isTestRunnerArg);
}

async function ensureTestDatabaseExists(): Promise<void> {
  const url = buildDatabaseUrl();
  try {
    const parsed = new URL(url);
    const dbName = parsed.pathname.replace(/^\//, "");
    const adminUrl = new URL(url);
    adminUrl.pathname = "/postgres";

    const adminPool = new Pool({ connectionString: adminUrl.toString() });
    try {
      await adminPool.query('CREATE DATABASE "' + dbName + '";');
      console.log(`[database] Created missing test database: ${dbName}`);
    } catch (e: unknown) {
      // Ignore if database already exists or creation fails for other reasons
      void e;
    } finally {
      await adminPool.end();
    }
  } catch {
    // ignore URL parsing issues
  }
}

function buildPostgresUrl(
  user: string,
  password: string,
  host: string,
  port: string,
  db: string,
): string {
  const url = new URL("postgresql://localhost");
  url.username = user;
  url.password = password;
  url.hostname = host;
  url.port = port;
  url.pathname = `/${db}`;
  return url.toString();
}

export function buildDatabaseUrl(): string {
  if (isTestEnv()) {
    const urlTest = process.env.DATABASE_URL_TEST;
    if (urlTest && urlTest.length > 0) {
      return urlTest;
    }

    const user = process.env.POSTGRES_USER ?? "workshop_user";
    const password = process.env.POSTGRES_PASSWORD ?? "workshop_password";
    const host = process.env.POSTGRES_HOST ?? "postgres";
    const port = process.env.POSTGRES_PORT ?? "5432";
    const db = process.env.POSTGRES_DB_TEST ?? "workshop_db_test";

    return buildPostgresUrl(user, password, host, port, db);
  }

  const url = process.env.DATABASE_URL;
  if (url && url.length > 0) {
    return url;
  }

  const user = process.env.POSTGRES_USER ?? "workshop_user";
  const password = process.env.POSTGRES_PASSWORD ?? "workshop_password";
  const host = process.env.POSTGRES_HOST ?? "postgres";
  const port = process.env.POSTGRES_PORT ?? "5432";
  const db = process.env.POSTGRES_DB ?? "workshop_db";

  return buildPostgresUrl(user, password, host, port, db);
}

function buildSslConfig(): boolean | { rejectUnauthorized: boolean } | undefined {
  const sslEnv = process.env.POSTGRES_SSL;
  if (sslEnv === "false" || sslEnv === "0") {
    return undefined;
  }
  if (sslEnv === "true" || sslEnv === "1") {
    return { rejectUnauthorized: false };
  }
  if (isTestEnv()) {
    return undefined;
  }
  // Default to SSL for non-test environments when host is not localhost/postgres (i.e. RDS)
  const host = process.env.POSTGRES_HOST ?? "postgres";
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "postgres") {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export const pool = new Pool({
  connectionString: buildDatabaseUrl(),
  ssl: buildSslConfig(),
});

export const db = drizzle(pool);

let hasConnected = false;

async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureDatabaseConnection(): Promise<void> {
  if (hasConnected) {
    return;
  }

  const maxRetries = 10;
  const delayMs = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query("SELECT 1");
      hasConnected = true;
      console.log(
        `[database] Connection to PostgreSQL established successfully (attempt ${attempt}).`,
      );
      return;
    } catch (error) {
      // Auto-create test DB if it's missing (invalid_catalog_name)
      const code = (error as { code?: string }).code;
      if (isTestEnv() && code === "3D000") {
        await ensureTestDatabaseExists();
      }
      console.error(
        `[database] Failed to connect to PostgreSQL (attempt ${attempt} of ${maxRetries}).`,
      );

      if (attempt === maxRetries) {
        throw error;
      }

      await wait(delayMs);
    }
  }
}
