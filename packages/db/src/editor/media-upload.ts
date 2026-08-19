import { randomUUID } from "node:crypto";
import {
  MEDIA_TYPE,
  MEDIA_UPLOAD_ERROR,
  MediaRightsError,
  MediaUploadError,
  authorizeMediaUpload,
  canonicalizeOriginalFilename,
  generateMediaStorageKey,
  type StaffRole,
} from "@magazine/domain";
import { getDb } from "../client";
import { media } from "../schema/media";
import { normalizeUploadedImage } from "../media/normalize-image";
import type { MediaObjectStore } from "../storage/types";
import {
  eligibilityForRow,
  previewUrlForRow,
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

export async function commitStoredObject<T>(input: {
  storage: MediaObjectStore;
  storageKey: string;
  mediaId: string;
  byteSize: number;
  format: string;
  insert: () => Promise<T>;
}): Promise<T> {
  try {
    return await input.insert();
  } catch (error) {
    try {
      await input.storage.delete(input.storageKey);
    } catch (cleanupError) {
      console.error("media upload compensating delete failed", {
        mediaId: input.mediaId,
        failureClass: "compensating-delete",
        byteSize: input.byteSize,
        format: input.format,
      });
      void cleanupError;
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

  try {
    await input.storage.put({
      key: storageKey,
      body: normalized.bytes,
      contentType: normalized.mimeType,
    });
  } catch (error) {
    if (error instanceof MediaUploadError) {
      throw error;
    }
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_FAILED);
  }

  const db = getDb();
  const row = await commitStoredObject({
    storage: input.storage,
    storageKey,
    mediaId,
    byteSize: normalized.bytes.byteLength,
    format: normalized.format,
    insert: async () => {
      const [inserted] = await db
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
      return inserted;
    },
  });

  return {
    id: row.id,
    label: displayLabelForUpload(originalFilename, storageKey),
    mediaType: row.mediaType,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    previewUrl: previewUrlForRow(input.mediaPublicBaseUrl, row),
    creatorName: row.creatorName,
    creditLine: row.creditLine,
    eligibility: eligibilityForRow(row, now),
    usageCount: 0,
    createdAt: row.createdAt,
  };
}
