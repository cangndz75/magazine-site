import { Pool } from "pg";

const CRITICAL_TABLES = [
  "content_items",
  "content_versions",
  "media",
  "media_renditions",
  "public_cache_outbox",
] as const;

export async function verifyRestoredDatabase(databaseUrl: string): Promise<{
  databaseName: string;
  latestMigrationTag: string | null;
  criticalTables: string[];
}> {
  const pool = new Pool({
    connectionString: databaseUrl,
    application_name: "magazine_restore_verification",
  });
  try {
    const database = await pool.query<{ database_name: string }>(
      "SELECT current_database() AS database_name",
    );
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [[...CRITICAL_TABLES]],
    );
    const foundTables = tables.rows.map((row) => row.table_name);
    const missing = CRITICAL_TABLES.filter((table) => !foundTables.includes(table));
    if (missing.length > 0) {
      throw new Error(`Restored schema is missing critical tables: ${missing.join(", ")}`);
    }

    const migrations = await pool.query<{ table_path: string | null }>(
      `SELECT coalesce(
         to_regclass('drizzle.__drizzle_migrations')::text,
         to_regclass('public.__drizzle_migrations')::text
       ) AS table_path`,
    );
    let latestMigrationTag: string | null = null;
    const migrationTable = migrations.rows[0]?.table_path;
    if (migrationTable) {
      const latest = await pool.query<{ tag: string | null }>(
        `SELECT hash AS tag
         FROM ${migrationTable}
         ORDER BY created_at DESC
         LIMIT 1`,
      );
      latestMigrationTag = latest.rows[0]?.tag ?? null;
    }

    return {
      databaseName: database.rows[0]?.database_name ?? "",
      latestMigrationTag,
      criticalTables: foundTables,
    };
  } finally {
    await pool.end();
  }
}
