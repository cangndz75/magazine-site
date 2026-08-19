import { z } from "zod";
import { baseEnvSchema, httpUrlSchema, parseEnv } from "./base";

/**
 * Server-only environment for the public web application.
 * Do not import from Client Components.
 * Do not expose secrets via NEXT_PUBLIC_*.
 */
export const webEnvSchema = baseEnvSchema.extend({
  SITE_URL: httpUrlSchema,
  EDITOR_URL: httpUrlSchema,
  MEDIA_PUBLIC_BASE_URL: httpUrlSchema,
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function getWebEnv(
  source: Record<string, string | undefined> = process.env,
): WebEnv {
  return parseEnv(webEnvSchema, source, "web");
}
