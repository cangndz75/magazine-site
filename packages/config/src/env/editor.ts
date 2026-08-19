import { z } from "zod";
import { baseEnvSchema, httpUrlSchema, parseEnv } from "./base";

const mediaStorageModeSchema = z.enum(["local", "s3"]);

/**
 * Server-only environment for the private editor application.
 * Do not import from Client Components.
 * Do not expose secrets via NEXT_PUBLIC_*.
 */
export const editorEnvSchema = baseEnvSchema
  .extend({
    SITE_URL: httpUrlSchema,
    EDITOR_URL: httpUrlSchema,
    SCHEDULED_PUBLISH_RUNNER_SECRET: z
      .string()
      .min(32, "SCHEDULED_PUBLISH_RUNNER_SECRET must be at least 32 characters"),
    /** Server-only origin of the public web app used for cache-outbox delivery. Never expose via NEXT_PUBLIC_*. */
    PUBLIC_WEB_INTERNAL_BASE_URL: httpUrlSchema,
    /** Server-only machine secret for public web cache invalidation delivery. Never expose via NEXT_PUBLIC_*. */
    PUBLIC_CACHE_INVALIDATION_SECRET: z
      .string()
      .min(32, "PUBLIC_CACHE_INVALIDATION_SECRET must be at least 32 characters"),
    /** Server-only base URL for public media asset paths. Never expose via NEXT_PUBLIC_*. */
    MEDIA_PUBLIC_BASE_URL: httpUrlSchema.optional(),
    MEDIA_STORAGE_MODE: mediaStorageModeSchema.optional(),
    MEDIA_LOCAL_ROOT: z.string().min(1).optional(),
    MEDIA_S3_ENDPOINT: httpUrlSchema.optional(),
    MEDIA_S3_BUCKET: z.string().min(1).optional(),
    MEDIA_S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    MEDIA_S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    MEDIA_S3_REGION: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const hosted = value.APP_ENV === "production" || value.APP_ENV === "staging";
    if (hosted && value.MEDIA_STORAGE_MODE === "local") {
      ctx.addIssue({
        code: "custom",
        path: ["MEDIA_STORAGE_MODE"],
        message: "local filesystem storage is not allowed in staging or production",
      });
    }
    if (value.MEDIA_STORAGE_MODE === "local") {
      if (!value.MEDIA_LOCAL_ROOT) {
        ctx.addIssue({
          code: "custom",
          path: ["MEDIA_LOCAL_ROOT"],
          message: "MEDIA_LOCAL_ROOT is required when MEDIA_STORAGE_MODE=local",
        });
      }
      if (!value.MEDIA_PUBLIC_BASE_URL) {
        ctx.addIssue({
          code: "custom",
          path: ["MEDIA_PUBLIC_BASE_URL"],
          message: "MEDIA_PUBLIC_BASE_URL is required when MEDIA_STORAGE_MODE=local",
        });
      }
    }
    if (value.MEDIA_STORAGE_MODE === "s3") {
      if (!value.MEDIA_PUBLIC_BASE_URL) {
        ctx.addIssue({
          code: "custom",
          path: ["MEDIA_PUBLIC_BASE_URL"],
          message: "MEDIA_PUBLIC_BASE_URL is required when MEDIA_STORAGE_MODE=s3",
        });
      }
      if (!value.MEDIA_S3_ENDPOINT) {
        ctx.addIssue({
          code: "custom",
          path: ["MEDIA_S3_ENDPOINT"],
          message: "MEDIA_S3_ENDPOINT is required when MEDIA_STORAGE_MODE=s3",
        });
      }
      if (!value.MEDIA_S3_BUCKET) {
        ctx.addIssue({
          code: "custom",
          path: ["MEDIA_S3_BUCKET"],
          message: "MEDIA_S3_BUCKET is required when MEDIA_STORAGE_MODE=s3",
        });
      }
      if (!value.MEDIA_S3_ACCESS_KEY_ID) {
        ctx.addIssue({
          code: "custom",
          path: ["MEDIA_S3_ACCESS_KEY_ID"],
          message: "MEDIA_S3_ACCESS_KEY_ID is required when MEDIA_STORAGE_MODE=s3",
        });
      }
      if (!value.MEDIA_S3_SECRET_ACCESS_KEY) {
        ctx.addIssue({
          code: "custom",
          path: ["MEDIA_S3_SECRET_ACCESS_KEY"],
          message: "MEDIA_S3_SECRET_ACCESS_KEY is required when MEDIA_STORAGE_MODE=s3",
        });
      }
    }
  });

export type EditorEnv = z.infer<typeof editorEnvSchema>;

export function getEditorEnv(
  source: Record<string, string | undefined> = process.env,
): EditorEnv {
  return parseEnv(editorEnvSchema, source, "editor");
}
