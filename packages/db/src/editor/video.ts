import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  CAPABILITY,
  MEDIA_TYPE,
  STAFF_SCOPE_MODE,
  VIDEO_ERROR,
  VIDEO_PROVIDER,
  VideoError,
  canPerform,
  canonicalizeEditorialVideoWrite,
  hasCapability,
  nextMonotonicUpdatedAt,
  type EditorialVideoWriteInput,
  type StaffRole,
  type StaffScopeMode,
  type VideoDecision,
  type VideoProvider,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionCategories,
  contentVersions,
} from "../schema/content";
import { media } from "../schema/media";
import { contentVersionVideos, editorialVideoAssets } from "../schema/video";
import { loadMediaRenditionsByMediaIds, type StoredMediaRendition } from "../media/image-delivery";
import { eligibilityForRow } from "./media-projections";
import {
  resolveEditorVideoPoster,
  type EditorVideoPosterProjection,
  type VideoPosterSource,
} from "./video-projections";

export const EDITOR_VIDEO_PAGE_SIZE_DEFAULT = 24;
export const EDITOR_VIDEO_PAGE_SIZE_MAX = 48;
export const EDITOR_VIDEO_SEARCH_MAX = 120;

const posterMedia = alias(media, "video_poster_media");

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

export type EditorVideoListItem = {
  id: string;
  provider: string;
  providerVideoId: string;
  canonicalUrl: string;
  title: string;
  caption: string | null;
  durationSeconds: number | null;
  posterMediaId: string | null;
  posterSource: VideoPosterSource;
  posterPreviewUrl: string | null;
  posterWidth: number | null;
  posterHeight: number | null;
  hasRightsNote: boolean;
  hasProvenance: boolean;
  usageCount: number;
  updatedAt: Date;
};

export type EditorVideoUsage = {
  contentItemId: string;
  contentVersionId: string;
  title: string;
  slug: string;
  publicationStatus: string;
  workflowStatus: string;
  versionNumber: number;
  sortOrder: number;
  isPublishedVersion: boolean;
};

export type EditorVideoAssetDetail = EditorVideoAsset &
  EditorVideoPosterProjection & {
    posterLabel: string | null;
    posterEligibility: ReturnType<typeof eligibilityForRow> | null;
    usages: EditorVideoUsage[];
    usageCount: number;
  };

export type EditorVideoAssetListResult = {
  items: EditorVideoListItem[];
  nextCursor: string | null;
  totalCount: number;
};

type VideoCursorPayload = {
  id: string;
  updatedAt: string;
};

type StaffAccess = {
  roles: readonly StaffRole[];
  scopeMode: StaffScopeMode;
  scopedCategoryIds: readonly string[];
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

function parsePageSize(value: number | string | undefined): number {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return EDITOR_VIDEO_PAGE_SIZE_DEFAULT;
  }
  return Math.min(parsed, EDITOR_VIDEO_PAGE_SIZE_MAX);
}

function parseSearch(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, EDITOR_VIDEO_SEARCH_MAX);
}

export function parseEditorVideoPageSize(value: string | undefined): number {
  return parsePageSize(value);
}

export function parseEditorVideoSearch(value: string | undefined): string | null {
  return parseSearch(value);
}

export function encodeVideoCursor(payload: VideoCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeVideoCursor(raw: string | undefined): VideoCursorPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as VideoCursorPayload;
    if (!parsed.id || !parsed.updatedAt) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function searchFilter(term: string) {
  const sanitized = term.replace(/[%_]/g, "");
  if (sanitized.length === 0) {
    return undefined;
  }
  const pattern = `%${sanitized}%`;
  const lowered = sanitized.toLowerCase();
  const clauses = [
    ilike(editorialVideoAssets.title, pattern),
    ilike(editorialVideoAssets.providerVideoId, pattern),
    ilike(editorialVideoAssets.caption, pattern),
  ];
  if (lowered.includes("youtube")) {
    clauses.push(eq(editorialVideoAssets.provider, VIDEO_PROVIDER.YOUTUBE));
  }
  if (lowered.includes("vimeo")) {
    clauses.push(eq(editorialVideoAssets.provider, VIDEO_PROVIDER.VIMEO));
  }
  return or(...clauses);
}

function usageCountSubquery() {
  return sql<number>`(
    SELECT COUNT(*)::int
    FROM ${contentVersionVideos}
    WHERE ${contentVersionVideos.videoAssetId} = ${editorialVideoAssets.id}
  )`;
}

function usageExistsSql() {
  return sql`EXISTS (
    SELECT 1
    FROM ${contentVersionVideos}
    WHERE ${contentVersionVideos.videoAssetId} = ${editorialVideoAssets.id}
  )`;
}

function canReadContentCategory(
  access: StaffAccess,
  categoryId: string | null,
): boolean {
  if (!categoryId) {
    return false;
  }
  return canPerform({
    roles: access.roles,
    capability: CAPABILITY.CONTENT_READ,
    scopeMode: access.scopeMode,
    scopedCategoryIds: access.scopedCategoryIds,
    categoryId,
  });
}

function posterProjectionFor(
  asset: typeof editorialVideoAssets.$inferSelect,
  posterRow: {
    storageKey: string;
    width: number | null;
    height: number | null;
    renditions?: readonly StoredMediaRendition[];
  } | null,
  mediaPublicBaseUrl: string | undefined,
): EditorVideoPosterProjection {
  return resolveEditorVideoPoster({
    provider: asset.provider,
    providerVideoId: asset.providerVideoId,
    posterMediaId: asset.posterMediaId,
    posterRow,
    mediaPublicBaseUrl,
  });
}

export async function listEditorVideoAssets(input: {
  roles: readonly StaffRole[];
  mediaPublicBaseUrl?: string;
  q?: string;
  provider?: VideoProvider;
  poster?: "present" | "absent";
  used?: boolean;
  unused?: boolean;
  cursor?: string;
  pageSize?: number | string;
}): Promise<EditorVideoAssetListResult> {
  assertVideoRead(input.roles);
  const db = getDb();
  const pageSize = parsePageSize(input.pageSize);
  const search = parseSearch(input.q);
  const cursor = decodeVideoCursor(input.cursor);

  const baseFilters = [
    search ? searchFilter(search) : undefined,
    input.provider ? eq(editorialVideoAssets.provider, input.provider) : undefined,
    input.poster === "present"
      ? isNotNull(editorialVideoAssets.posterMediaId)
      : input.poster === "absent"
        ? isNull(editorialVideoAssets.posterMediaId)
        : undefined,
    input.used && !input.unused ? usageExistsSql() : undefined,
    input.unused && !input.used
      ? sql`NOT ${usageExistsSql()}`
      : undefined,
  ].filter((value): value is NonNullable<typeof value> => value !== undefined);

  const pageFilters = [
    ...baseFilters,
    cursor
      ? or(
          lt(editorialVideoAssets.updatedAt, sql`${cursor.updatedAt}::timestamptz`),
          and(
            eq(
              editorialVideoAssets.updatedAt,
              sql`${cursor.updatedAt}::timestamptz`,
            ),
            lt(editorialVideoAssets.id, cursor.id),
          ),
        )
      : undefined,
  ].filter((value): value is NonNullable<typeof value> => value !== undefined);

  const countWhere = baseFilters.length > 0 ? and(...baseFilters) : undefined;
  const whereClause = pageFilters.length > 0 ? and(...pageFilters) : undefined;

  const [countRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(editorialVideoAssets)
    .where(countWhere);

  const rows = await db
    .select({
      asset: editorialVideoAssets,
      posterMediaId: posterMedia.id,
      posterStorageKey: posterMedia.storageKey,
      posterWidth: posterMedia.width,
      posterHeight: posterMedia.height,
      usageCount: usageCountSubquery(),
    })
    .from(editorialVideoAssets)
    .leftJoin(posterMedia, eq(posterMedia.id, editorialVideoAssets.posterMediaId))
    .where(whereClause)
    .orderBy(desc(editorialVideoAssets.updatedAt), desc(editorialVideoAssets.id))
    .limit(pageSize + 1);

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const last = pageRows[pageRows.length - 1];
  const renditionsByMediaId = await loadMediaRenditionsByMediaIds(
    pageRows
      .map((row) => row.posterMediaId)
      .filter((id): id is string => Boolean(id)),
  );

  return {
    items: pageRows.map((row) => {
      const poster = posterProjectionFor(
        row.asset,
        row.posterStorageKey
          ? {
              storageKey: row.posterStorageKey,
              width: row.posterWidth,
              height: row.posterHeight,
              renditions: row.posterMediaId
                ? renditionsByMediaId.get(row.posterMediaId)
                : undefined,
            }
          : null,
        input.mediaPublicBaseUrl,
      );
      return {
        id: row.asset.id,
        provider: row.asset.provider,
        providerVideoId: row.asset.providerVideoId,
        canonicalUrl: row.asset.canonicalUrl,
        title: row.asset.title,
        caption: row.asset.caption,
        durationSeconds: row.asset.durationSeconds,
        posterMediaId: row.asset.posterMediaId,
        posterSource: poster.posterSource,
        posterPreviewUrl: poster.posterPreviewUrl,
        posterWidth: poster.posterWidth,
        posterHeight: poster.posterHeight,
        hasRightsNote: Boolean(row.asset.rightsNote),
        hasProvenance: Boolean(row.asset.provenance),
        usageCount: Number(row.usageCount ?? 0),
        updatedAt: row.asset.updatedAt,
      };
    }),
    nextCursor:
      hasMore && last
        ? encodeVideoCursor({
            id: last.asset.id,
            updatedAt: last.asset.updatedAt.toISOString(),
          })
        : null,
    totalCount: Number(countRow?.total ?? 0),
  };
}

export async function getEditorVideoAsset(input: {
  videoAssetId: string;
  roles: readonly StaffRole[];
  scopeMode?: StaffScopeMode;
  scopedCategoryIds?: readonly string[];
  mediaPublicBaseUrl?: string;
}): Promise<EditorVideoAssetDetail> {
  assertVideoRead(input.roles);
  const db = getDb();
  const [row] = await db
    .select({
      asset: editorialVideoAssets,
      poster: posterMedia,
    })
    .from(editorialVideoAssets)
    .leftJoin(posterMedia, eq(posterMedia.id, editorialVideoAssets.posterMediaId))
    .where(eq(editorialVideoAssets.id, input.videoAssetId))
    .limit(1);

  if (!row) {
    throw new VideoError(VIDEO_ERROR.NOT_FOUND);
  }

  const access: StaffAccess = {
    roles: input.roles,
    scopeMode: input.scopeMode ?? STAFF_SCOPE_MODE.ALL,
    scopedCategoryIds: input.scopedCategoryIds ?? [],
  };

  const usageRows = await db
    .select({
      contentItemId: contentItems.id,
      contentVersionId: contentVersions.id,
      title: contentVersions.title,
      slug: contentItems.slug,
      publicationStatus: contentItems.publicationStatus,
      workflowStatus: contentVersions.workflowStatus,
      versionNumber: contentVersions.versionNumber,
      sortOrder: contentVersionVideos.sortOrder,
      publishedVersionId: contentItems.publishedVersionId,
      primaryCategoryId: contentVersionCategories.categoryId,
    })
    .from(contentVersionVideos)
    .innerJoin(
      contentVersions,
      eq(contentVersionVideos.contentVersionId, contentVersions.id),
    )
    .innerJoin(contentItems, eq(contentVersions.contentItemId, contentItems.id))
    .leftJoin(
      contentVersionCategories,
      and(
        eq(contentVersionCategories.contentVersionId, contentVersions.id),
        eq(contentVersionCategories.isPrimary, true),
      ),
    )
    .where(eq(contentVersionVideos.videoAssetId, input.videoAssetId))
    .orderBy(desc(contentVersions.createdAt), contentVersionVideos.sortOrder);

  const usages: EditorVideoUsage[] = [];
  for (const usage of usageRows) {
    if (!canReadContentCategory(access, usage.primaryCategoryId)) {
      continue;
    }
    usages.push({
      contentItemId: usage.contentItemId,
      contentVersionId: usage.contentVersionId,
      title: usage.title,
      slug: usage.slug,
      publicationStatus: usage.publicationStatus,
      workflowStatus: usage.workflowStatus,
      versionNumber: usage.versionNumber,
      sortOrder: usage.sortOrder,
      isPublishedVersion: usage.publishedVersionId === usage.contentVersionId,
    });
  }

  const posterRenditions = row.poster
    ? await loadMediaRenditionsByMediaIds([row.poster.id])
    : new Map();
  const poster = posterProjectionFor(
    row.asset,
    row.poster
      ? {
          storageKey: row.poster.storageKey,
          width: row.poster.width,
          height: row.poster.height,
          renditions: posterRenditions.get(row.poster.id),
        }
      : null,
    input.mediaPublicBaseUrl,
  );

  return {
    ...toEditorVideoAsset(row.asset),
    ...poster,
    posterLabel: row.poster?.originalFilename ?? row.poster?.storageKey ?? null,
    posterEligibility: row.poster
      ? eligibilityForRow(row.poster, new Date())
      : null,
    usages,
    usageCount: usages.length,
  };
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
