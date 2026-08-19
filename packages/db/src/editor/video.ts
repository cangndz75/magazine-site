import { desc, eq, inArray } from "drizzle-orm";
import {
  CAPABILITY,
  MEDIA_TYPE,
  VIDEO_ERROR,
  VideoError,
  canonicalizeEditorialVideoWrite,
  hasCapability,
  nextMonotonicUpdatedAt,
  type EditorialVideoWriteInput,
  type StaffRole,
  type VideoDecision,
} from "@magazine/domain";
import { getDb } from "../client";
import { media } from "../schema/media";
import { editorialVideoAssets } from "../schema/video";

export type EditorVideoAsset = {
  id: string;
  provider: string;
  providerVideoId: string;
  canonicalUrl: string;
  submittedUrl: string;
  title: string;
  caption: string | null;
  description: string | null;
  durationSeconds: number | null;
  posterMediaId: string | null;
  rightsNote: string | null;
  provenance: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EditorVideoAssetListResult = {
  items: EditorVideoAsset[];
};

function unwrapVideoDecision<T>(decision: VideoDecision<T>): T {
  if (!decision.ok) {
    throw new VideoError(decision.code);
  }
  return decision.value;
}

function assertVideoRead(roles: readonly StaffRole[]): void {
  if (!hasCapability(roles, CAPABILITY.CONTENT_READ)) {
    throw new VideoError(VIDEO_ERROR.FORBIDDEN);
  }
}

function assertVideoWrite(roles: readonly StaffRole[]): void {
  if (!hasCapability(roles, CAPABILITY.CONTENT_EDIT)) {
    throw new VideoError(VIDEO_ERROR.FORBIDDEN);
  }
}

function isPgDuplicate(error: unknown, constraint: string): boolean {
  const candidate =
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    typeof (error as { cause: unknown }).cause === "object" &&
    (error as { cause: unknown }).cause !== null
      ? (error as { cause: unknown }).cause
      : error;

  return (
    typeof error === "object" &&
      error !== null &&
      typeof candidate === "object" &&
      candidate !== null &&
      (candidate as { code?: unknown }).code === "23505" &&
      (candidate as { constraint?: unknown }).constraint === constraint
  );
}

async function assertPosterImage(
  posterMediaId: string | null,
): Promise<void> {
  if (posterMediaId === null) {
    return;
  }

  const db = getDb();
  const [row] = await db
    .select({ id: media.id, mediaType: media.mediaType })
    .from(media)
    .where(eq(media.id, posterMediaId))
    .limit(1);

  if (!row || row.mediaType !== MEDIA_TYPE.IMAGE) {
    throw new VideoError(VIDEO_ERROR.INVALID_POSTER);
  }
}

function toEditorVideoAsset(
  row: typeof editorialVideoAssets.$inferSelect,
): EditorVideoAsset {
  return {
    id: row.id,
    provider: row.provider,
    providerVideoId: row.providerVideoId,
    canonicalUrl: row.canonicalUrl,
    submittedUrl: row.submittedUrl,
    title: row.title,
    caption: row.caption,
    description: row.description,
    durationSeconds: row.durationSeconds,
    posterMediaId: row.posterMediaId,
    rightsNote: row.rightsNote,
    provenance: row.provenance,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listEditorVideoAssets(input: {
  roles: readonly StaffRole[];
  limit?: number;
}): Promise<EditorVideoAssetListResult> {
  assertVideoRead(input.roles);
  const db = getDb();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const rows = await db
    .select()
    .from(editorialVideoAssets)
    .orderBy(desc(editorialVideoAssets.updatedAt), desc(editorialVideoAssets.id))
    .limit(limit);
  return { items: rows.map(toEditorVideoAsset) };
}

export async function getEditorVideoAsset(input: {
  videoAssetId: string;
  roles: readonly StaffRole[];
}): Promise<EditorVideoAsset> {
  assertVideoRead(input.roles);
  const db = getDb();
  const [row] = await db
    .select()
    .from(editorialVideoAssets)
    .where(eq(editorialVideoAssets.id, input.videoAssetId))
    .limit(1);
  if (!row) {
    throw new VideoError(VIDEO_ERROR.NOT_FOUND);
  }
  return toEditorVideoAsset(row);
}

export async function createEditorVideoAsset(input: {
  roles: readonly StaffRole[];
  video: EditorialVideoWriteInput;
}): Promise<EditorVideoAsset> {
  assertVideoWrite(input.roles);
  const video = unwrapVideoDecision(canonicalizeEditorialVideoWrite(input.video));
  await assertPosterImage(video.posterMediaId);

  const db = getDb();
  try {
    const now = new Date();
    const [created] = await db
      .insert(editorialVideoAssets)
      .values({
        provider: video.provider,
        providerVideoId: video.providerVideoId,
        canonicalUrl: video.canonicalUrl,
        submittedUrl: video.submittedUrl,
        title: video.title,
        caption: video.caption,
        description: video.description,
        durationSeconds: video.durationSeconds,
        posterMediaId: video.posterMediaId,
        rightsNote: video.rightsNote,
        provenance: video.provenance,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to create video asset.");
    }
    return toEditorVideoAsset(created);
  } catch (error) {
    if (isPgDuplicate(error, "editorial_video_assets_provider_video_key")) {
      throw new VideoError(VIDEO_ERROR.DUPLICATE_VIDEO);
    }
    throw error;
  }
}

export async function updateEditorVideoAsset(input: {
  videoAssetId: string;
  roles: readonly StaffRole[];
  expectedUpdatedAt: Date | string;
  video: EditorialVideoWriteInput;
}): Promise<EditorVideoAsset> {
  assertVideoWrite(input.roles);
  const video = unwrapVideoDecision(canonicalizeEditorialVideoWrite(input.video));
  await assertPosterImage(video.posterMediaId);
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: editorialVideoAssets.id, updatedAt: editorialVideoAssets.updatedAt })
        .from(editorialVideoAssets)
        .where(eq(editorialVideoAssets.id, input.videoAssetId))
        .for("update");
      if (!locked) {
        throw new VideoError(VIDEO_ERROR.NOT_FOUND);
      }

      const expectedMs = new Date(input.expectedUpdatedAt).getTime();
      if (
        Number.isNaN(expectedMs) ||
        locked.updatedAt.getTime() !== expectedMs
      ) {
        throw new VideoError(VIDEO_ERROR.STALE_WRITE);
      }

      const [updated] = await tx
        .update(editorialVideoAssets)
        .set({
          provider: video.provider,
          providerVideoId: video.providerVideoId,
          canonicalUrl: video.canonicalUrl,
          submittedUrl: video.submittedUrl,
          title: video.title,
          caption: video.caption,
          description: video.description,
          durationSeconds: video.durationSeconds,
          posterMediaId: video.posterMediaId,
          rightsNote: video.rightsNote,
          provenance: video.provenance,
          updatedAt: nextMonotonicUpdatedAt(locked.updatedAt),
        })
        .where(eq(editorialVideoAssets.id, locked.id))
        .returning();
      if (!updated) {
        throw new VideoError(VIDEO_ERROR.NOT_FOUND);
      }
      return toEditorVideoAsset(updated);
    });
  } catch (error) {
    if (isPgDuplicate(error, "editorial_video_assets_provider_video_key")) {
      throw new VideoError(VIDEO_ERROR.DUPLICATE_VIDEO);
    }
    throw error;
  }
}

export async function assertVideoAssetsExist(
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const uniqueIds = [...new Set(ids)];
  const db = getDb();
  const rows = await db
    .select({ id: editorialVideoAssets.id })
    .from(editorialVideoAssets)
    .where(inArray(editorialVideoAssets.id, uniqueIds));
  if (rows.length !== uniqueIds.length) {
    throw new VideoError(VIDEO_ERROR.NOT_FOUND);
  }
}
