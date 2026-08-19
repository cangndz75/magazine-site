import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  MEDIA_UPLOAD_ERROR,
  MediaUploadError,
  assertSafeMediaStorageKey,
} from "@magazine/domain";
import type { MediaObjectPutInput, MediaObjectStore } from "./types";

export type S3MediaObjectStoreConfig = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
};

export function createS3MediaObjectStore(
  config: S3MediaObjectStoreConfig,
): MediaObjectStore {
  const client = new S3Client({
    region: config.region ?? "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });

  function requireKey(key: string): string {
    const decision = assertSafeMediaStorageKey(key);
    if (!decision.ok) {
      throw new MediaUploadError(MEDIA_UPLOAD_ERROR.INVALID_UPLOAD);
    }
    return decision.value;
  }

  return {
    async put(input: MediaObjectPutInput) {
      const key = requireKey(input.key);
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: key,
            Body: input.body,
            ContentType: input.contentType,
          }),
        );
      } catch {
        throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_FAILED);
      }
    },
    async delete(key: string) {
      const safeKey = requireKey(key);
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: safeKey,
          }),
        );
      } catch {
        throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_FAILED);
      }
    },
  };
}
