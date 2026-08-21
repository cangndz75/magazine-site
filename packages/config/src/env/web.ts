import { z } from "zod";
import { baseEnvSchema, httpUrlSchema, optionalNonEmptyString, parseEnv } from "./base";

/**
 * Server-only environment for the public web application.
 * Do not import from Client Components.
 * Do not expose secrets via NEXT_PUBLIC_*.
 */
export const webEnvSchema = baseEnvSchema.extend({
  SITE_URL: httpUrlSchema,
  EDITOR_URL: httpUrlSchema,
  MEDIA_PUBLIC_BASE_URL: httpUrlSchema,
  /** Server-only machine secret for public article cache invalidation. Never expose via NEXT_PUBLIC_*. */
  PUBLIC_CACHE_INVALIDATION_SECRET: z
    .string()
    .min(32, "PUBLIC_CACHE_INVALIDATION_SECRET must be at least 32 characters"),
  /**
   * Public NewsArticle publisher identity. Name is required to emit publisher.
   * URL and logo are omitted when missing or invalid; they are not defaulted
   * to SITE_URL. Never NEXT_PUBLIC_*.
   */
  SITE_PUBLISHER_NAME: optionalNonEmptyString,
  SITE_PUBLISHER_URL: optionalNonEmptyString,
  SITE_PUBLISHER_LOGO_URL: optionalNonEmptyString,
});

export type WebEnv = z.infer<typeof webEnvSchema>;

export function getWebEnv(
  source: Record<string, string | undefined> = process.env,
): WebEnv {
  return parseEnv(webEnvSchema, source, "web");
}
