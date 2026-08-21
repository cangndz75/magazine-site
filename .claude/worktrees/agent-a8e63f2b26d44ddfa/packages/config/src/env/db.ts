import { z } from "zod";
import { baseEnvSchema, parseEnv } from "./base";

/**
 * Server-only database connection environment.
 * Do not import from Client Components.
 * Do not expose DATABASE_URL via NEXT_PUBLIC_*.
 */
export const dbEnvSchema = baseEnvSchema.extend({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres:// or postgresql:// URL",
    ),
});

export type DbEnv = z.infer<typeof dbEnvSchema>;

export function getDbEnv(
  source: Record<string, string | undefined> = process.env,
): DbEnv {
  return parseEnv(dbEnvSchema, source, "database");
}
