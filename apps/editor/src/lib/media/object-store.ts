import "server-only";

import {
  createLocalMediaObjectStore,
  createS3MediaObjectStore,
  type MediaObjectStore,
} from "@magazine/db/storage";
import { MEDIA_UPLOAD_ERROR, MediaUploadError } from "@magazine/domain";
import type { EditorEnv } from "@magazine/config/env/editor";

export function createMediaObjectStoreFromEnv(env: EditorEnv): MediaObjectStore {
  if (env.MEDIA_STORAGE_MODE === "local") {
    if (!env.MEDIA_LOCAL_ROOT) {
      throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_NOT_CONFIGURED);
    }
    return createLocalMediaObjectStore(env.MEDIA_LOCAL_ROOT);
  }

  if (env.MEDIA_STORAGE_MODE === "s3") {
    if (
      !env.MEDIA_S3_ENDPOINT ||
      !env.MEDIA_S3_BUCKET ||
      !env.MEDIA_S3_ACCESS_KEY_ID ||
      !env.MEDIA_S3_SECRET_ACCESS_KEY
    ) {
      throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_NOT_CONFIGURED);
    }
    return createS3MediaObjectStore({
      endpoint: env.MEDIA_S3_ENDPOINT,
      bucket: env.MEDIA_S3_BUCKET,
      accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID,
      secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY,
      region: env.MEDIA_S3_REGION,
    });
  }

  throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_NOT_CONFIGURED);
}
