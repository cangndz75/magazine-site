import { defineConfig } from "drizzle-kit";

/**
 * generate/check read the TypeScript schema only.
 * migrate requires DATABASE_URL and is guarded by scripts/require-database-url.mjs.
 * Do not use drizzle-kit push.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : undefined,
});
