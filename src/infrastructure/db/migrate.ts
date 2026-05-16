import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { ensureDatabaseConnection, pool, buildDatabaseUrl } from "./index";

const MIGRATIONS_TABLE = "schema_migrations";
const MIGRATIONS_DIR = path.resolve(__dirname, "migrations");

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  );
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>(
    `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY id ASC`,
  );

  return new Set(result.rows.map((row) => row.name));
}

async function applyMigration(fileName: string, sql: string): Promise<void> {
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [fileName]);
    await pool.query("COMMIT");
    console.log(`[migrations] Applied migration: ${fileName}`);
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error(`[migrations] Failed to apply migration: ${fileName}`);
    throw error;
  }
}

export async function runMigrations(): Promise<void> {
  await ensureDatabaseConnection();
  try {
    const url = buildDatabaseUrl();
    const parsed = new URL(url);
    const dbName = parsed.pathname.replace(/^\//, "");
    console.log(`[migrations] Target database: ${dbName}`);
  } catch {
    // silently ignore logging if URL parsing fails
  }
  await ensureMigrationsTable();

  const appliedMigrations = await getAppliedMigrations();

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const fileName of files) {
    if (appliedMigrations.has(fileName)) {
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, fileName);
    const sql = readFileSync(filePath, "utf-8");

    await applyMigration(fileName, sql);
  }

  console.log("[migrations] All migrations are up to date.");
}

if (import.meta.main) {
  runMigrations()
    .then(() => {
      console.log("[migrations] Finished running migrations.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[migrations] Error while running migrations:", error);
      process.exit(1);
    });
}
