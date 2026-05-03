import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { ensureDatabaseConnection, pool } from "./index";

const SEEDS_DIR = path.resolve(__dirname, "seeds");

async function applySeed(fileName: string, sql: string): Promise<void> {
  await pool.query("BEGIN");
  try {
    await pool.query(sql);
    await pool.query("COMMIT");
    console.log(`[seeds] Applied seed: ${fileName}`);
  } catch (error) {
    await pool.query("ROLLBACK");
    console.error(`[seeds] Failed to apply seed: ${fileName}`);
    throw error;
  }
}

export async function runSeeds(): Promise<void> {
  await ensureDatabaseConnection();

  if (!existsSync(SEEDS_DIR)) {
    console.log("[seeds] No seeds directory found.");
    return;
  }

  const files = readdirSync(SEEDS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[seeds] No seed files found.");
    return;
  }

  for (const fileName of files) {
    const filePath = path.join(SEEDS_DIR, fileName);
    const sql = readFileSync(filePath, "utf-8");

    await applySeed(fileName, sql);
  }

  console.log("[seeds] Finished running seeds.");
}

if (import.meta.main) {
  runSeeds()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error("[seeds] Error while running seeds:", error);
      process.exit(1);
    });
}
