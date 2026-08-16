import { z } from "zod";
import { baseEnvSchema, httpUrlSchema, parseEnv } from "./base";

/**
 * Server-only environment for the private editor application.
 * Do not import from Client Components.
 * Do not expose secrets via NEXT_PUBLIC_*.
 */
export const editorEnvSchema = baseEnvSchema.extend({
  SITE_URL: httpUrlSchema,
  EDITOR_URL: httpUrlSchema,
});

export type EditorEnv = z.infer<typeof editorEnvSchema>;

export function getEditorEnv(
  source: Record<string, string | undefined> = process.env,
): EditorEnv {
  return parseEnv(editorEnvSchema, source, "editor");
}
