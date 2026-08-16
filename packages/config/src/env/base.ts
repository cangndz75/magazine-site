import { z } from "zod";

export const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  APP_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
});

export const httpUrlSchema = z.url({
  protocol: /^https?$/,
  error: "must be a valid http(s) URL",
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;

export function parseEnv<T>(
  schema: z.ZodType<T>,
  source: Record<string, string | undefined>,
  label: string,
): T {
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new Error(
      `Invalid ${label} environment variables:\n${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
