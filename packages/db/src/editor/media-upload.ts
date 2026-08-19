import { randomUUID } from "node:crypto";
import {
  MEDIA_TYPE,
  MEDIA_UPLOAD_ERROR,
  MEDIA_RENDITION_SURFACE,
  MediaRightsError,
  MediaUploadError,
  authorizeMediaUpload,
  canonicalizeOriginalFilename,
  generateMediaStorageKey,
  type StaffRole,
} from "@magazine/domain";
import { getDb } from "../client";
import { media, mediaRenditions } from "../schema/media";
import { generateImageRenditions } from "../media/generate-renditions";
import { normalizeUploadedImage } from "../media/normalize-image";
import type { MediaObjectStore } from "../storage/types";
import {
  eligibilityForRow,
  previewUrlForImageSurface,
} from "./media-projections";
import type { EditorMediaListItem } from "./media-library";

export type UploadEditorImageInput = {
  roles: readonly StaffRole[];
  bytes: Buffer;
  originalFilename?: string | null;
  storage: MediaObjectStore;
  mediaPublicBaseUrl: string | undefined;
  now?: Date;
};

function displayLabelForUpload(originalFilename: string, storageKey: string): string {
  return originalFilename.length > 0
    ? originalFilename
    : (storageKey.split("/").pop() ?? storageKey);
}

async function compensatingDelete(
  storage: MediaObjectStore,
  keys: readonly string[],
  context: { mediaId: string; byteSize: number; format: string },
): Promise<{ failed: boolean }> {
  let failed = false;
  for (const key of keys) {
    try {
      await storage.delete(key);
    } catch (cleanupError) {
      failed = true;
      console.error("media upload compensating delete failed", {
        mediaId: context.mediaId,
        failureClass: "compensating-delete",
        byteSize: context.byteSize,
        format: context.format,
      });
      void cleanupError;
    }
  }
  return { failed };
}

export async function commitStoredObject<T>(input: {
  storage: MediaObjectStore;
  storageKey: string;
  derivativeKeys?: readonly string[];
  mediaId: string;
  byteSize: number;
  format: string;
  insert: () => Promise<T>;
}): Promise<T> {
  const keys = [input.storageKey, ...(input.derivativeKeys ?? [])];
  try {
    return await input.insert();
  } catch (error) {
    const cleanup = await compensatingDelete(input.storage, keys, {
      mediaId: input.mediaId,
      byteSize: input.byteSize,
      format: input.format,
    });
    if (cleanup.failed) {
      if (error instanceof MediaUploadError) {
        throw error;
      }
      throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_FAILED);
    }
    if (error instanceof MediaUploadError || error instanceof MediaRightsError) {
      throw error;
    }
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_FAILED);
  }
}

export async function putStoredObjects(input: {
  storage: MediaObjectStore;
  objects: ReadonlyArray<{ key: string; body: Buffer; contentType: string }>;
  mediaId: string;
  byteSize: number;
  format: string;
}): Promise<void> {
  const written: string[] = [];
  try {
    for (const object of input.objects) {
      await input.storage.put({
        key: object.key,
        body: object.body,
        contentType: object.contentType,
      });
      written.push(object.key);
    }
  } catch (error) {
    const cleanup = await compensatingDelete(input.storage, written, {
      mediaId: input.mediaId,
      byteSize: input.byteSize,
      format: input.format,
    });
    if (error instanceof MediaUploadError) {
      throw error;
    }
    if (cleanup.failed) {
      throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_FAILED);
    }
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_FAILED);
  }
}

export async function uploadEditorImage(
  input: UploadEditorImageInput,
): Promise<EditorMediaListItem> {
  const authorized = authorizeMediaUpload({ roles: input.roles });
  if (!authorized.ok) {
    throw new MediaUploadError(authorized.code);
  }
  if (!input.mediaPublicBaseUrl) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_NOT_CONFIGURED);
  }

  const now = input.now ?? new Date();
  const normalized = await normalizeUploadedImage(input.bytes);
  const originalFilename = canonicalizeOriginalFilename(
    input.originalFilename,
    normalized.format,
  );
  const mediaId = randomUUID();
  const storageKey = generateMediaStorageKey({
    now,
    id: mediaId,
    format: normalized.format,
  });
  const renditions = await generateImageRenditions({
    originalStorageKey: storageKey,
    normalized,
  });

  await putStoredObjects({
    storage: input.storage,
    mediaId,
    byteSize: normalized.bytes.byteLength,
    format: normalized.format,
    objects: [
      {
        key: storageKey,
        body: normalized.bytes,
        contentType: normalized.mimeType,
      },
      ...renditions.map((rendition) => ({
        key: rendition.storageKey,
        body: rendition.bytes,
        contentType: normalized.mimeType,
      })),
    ],
  });

  const db = getDb();
  const row = await commitStoredObject({
    storage: input.storage,
    storageKey,
    derivativeKeys: renditions.map((rendition) => rendition.storageKey),
    mediaId,
    byteSize: normalized.bytes.byteLength,
    format: normalized.format,
    insert: async () => {
      return db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(media)
          .values({
            id: mediaId,
            storageKey,
            mediaType: MEDIA_TYPE.IMAGE,
            mimeType: normalized.mimeType,
            width: normalized.width,
            height: normalized.height,
            byteSize: normalized.bytes.byteLength,
            originalFilename,
            contentHash: normalized.contentHash,
          })
          .returning();
        if (!inserted) {
          throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_FAILED);
        }
        if (renditions.length > 0) {
          await tx.insert(mediaRenditions).values(
            renditions.map((rendition) => ({
              mediaId,
              variant: rendition.variant,
              storageKey: rendition.storageKey,
              width: rendition.width,
              height: rendition.height,
              byteSize: rendition.byteSize,
            })),
          );
        }
        return inserted;
      });
    },
  });

  return {
    id: row.id,
    label: displayLabelForUpload(originalFilename, storageKey),
    mediaType: row.mediaType,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    previewUrl: previewUrlForImageSurface({
      mediaPublicBaseUrl: input.mediaPublicBaseUrl,
      originalStorageKey: storageKey,
      originalWidth: row.width,
      originalHeight: row.height,
      renditions: renditions.map((rendition) => ({
        mediaId,
        variant: rendition.variant,
        storageKey: rendition.storageKey,
        width: rendition.width,
        height: rendition.height,
        byteSize: rendition.byteSize,
      })),
      surface: MEDIA_RENDITION_SURFACE.LIBRARY_CARD,
    }),
    creatorName: row.creatorName,
    creditLine: row.creditLine,
    eligibility: eligibilityForRow(row, now),
    usageCount: 0,
    createdAt: row.createdAt,
  };
}
