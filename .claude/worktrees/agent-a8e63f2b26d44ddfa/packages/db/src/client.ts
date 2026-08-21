import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getDbEnv } from "@magazine/config/env/db";
import * as schema from "./schema/index";

let pool: Pool | undefined;
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * Lazy PostgreSQL pool. Importing @magazine/db/schema does not connect.
 * Importing this module does not connect until getDb() is called.
 */
export function getDb() {
  if (!db) {
    const env = getDbEnv();
    pool = new Pool({ connectionString: env.DATABASE_URL });
    db = drizzle(pool, { schema });
  }

  return db;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
  }

  pool = undefined;
  db = undefined;
}
