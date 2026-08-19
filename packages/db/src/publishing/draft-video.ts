import { asc, eq, inArray } from "drizzle-orm";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  PUBLISHING_ERROR,
  PublishingError,
  VIDEO_ERROR,
  VIDEO_TEXT_MAX,
  VideoError,
  assertContentNotDeleted,
  decideLockedDraftSave,
  nextMonotonicUpdatedAt,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";
import { media } from "../schema/media";
import { contentVersionVideos, editorialVideoAssets } from "../schema/video";
import { unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";
import { loadLockedDisplayCategories } from "./locked-scope";
import {
  appendContentAuditEvent,
  buildDraftUpdateChangeSet,
  staffAuditActor,
} from "./audit";
import { loadVersionRelations } from "./relations";
import type { PublishingTx } from "./db-types";
import { resolveEditorVideoPoster } from "../editor/video-projections";
import { loadMediaRenditionsByMediaIds } from "../media/image-delivery";

export type ContentVideoRelationInput = {
  videoAssetId: string;
  sortOrder: number;
  caption: string | null;
};

export type DraftVideoItemInput = {
  videoAssetId: string;
  caption?: string | null;
};

export type ArticleEditorVideoAttachment = {
  id: string;
  provider: string;
  providerVideoId: string;
  canonicalUrl: string;
  title: string;
  caption: string | null;
  assetCaption: string | null;
  durationSeconds: number | null;
  posterMediaId: string | null;
  posterPreviewUrl: string | null;
  posterSource: "EDITORIAL" | "PROVIDER" | "NONE";
  rightsNote: string | null;
  provenance: string | null;
  sortOrder: number;
};

export type DraftVersionVideoResult = {
  contentItemId: string;
  versionId: string;
  updatedAt: Date;
  videos: ArticleEditorVideoAttachment[];
};

export type SetDraftVersionVideosInput = {
  contentItemId: string;
  versionId: string;
  expectedUpdatedAt: Date | string;
  items: readonly DraftVideoItemInput[];
  scope: EditorStaffScope;
  actorId: string;
  mediaPublicBaseUrl?: string;
};

function canonicalizeCaption(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > VIDEO_TEXT_MAX.CAPTION) {
    throw new VideoError(VIDEO_ERROR.INVALID_METADATA);
  }
  return trimmed;
}

function canonicalizeDraftVideoItems(
  items: readonly DraftVideoItemInput[],
): ContentVideoRelationInput[] {
  const seen = new Set<string>();
  return items.map((item, index) => {
    const videoAssetId = item.videoAssetId.trim();
    if (!videoAssetId || seen.has(videoAssetId)) {
      throw new PublishingError(PUBLISHING_ERROR.DUPLICATE_RELATION);
    }
    seen.add(videoAssetId);
    return {
      videoAssetId,
      sortOrder: index,
      caption: canonicalizeCaption(item.caption),
    };
  });
}

export async function loadVersionVideoRelations(
  tx: PublishingTx,
  contentVersionId: string,
): Promise<ContentVideoRelationInput[]> {
  const rows = await tx
    .select({
      videoAssetId: contentVersionVideos.videoAssetId,
      sortOrder: contentVersionVideos.sortOrder,
      caption: contentVersionVideos.caption,
    })
    .from(contentVersionVideos)
    .where(eq(contentVersionVideos.contentVersionId, contentVersionId))
    .orderBy(asc(contentVersionVideos.sortOrder));

  return rows.map((row) => ({
    videoAssetId: row.videoAssetId,
    sortOrder: row.sortOrder,
    caption: row.caption,
  }));
}

export async function insertVersionVideoRelations(
  tx: PublishingTx,
  contentVersionId: string,
  videos: readonly ContentVideoRelationInput[],
): Promise<void> {
  if (videos.length === 0) {
    return;
  }
  await tx.insert(contentVersionVideos).values(
    videos.map((item) => ({
      contentVersionId,
      videoAssetId: item.videoAssetId,
      sortOrder: item.sortOrder,
      caption: item.caption,
    })),
  );
}

async function loadVideoAttachments(
  tx: PublishingTx,
  contentVersionId: string,
  mediaPublicBaseUrl: string | undefined,
): Promise<ArticleEditorVideoAttachment[]> {
  const rows = await tx
    .select({
      asset: editorialVideoAssets,
      sortOrder: contentVersionVideos.sortOrder,
      relationCaption: contentVersionVideos.caption,
      posterMediaId: media.id,
      posterStorageKey: media.storageKey,
      posterWidth: media.width,
      posterHeight: media.height,
    })
    .from(contentVersionVideos)
    .innerJoin(
      editorialVideoAssets,
      eq(editorialVideoAssets.id, contentVersionVideos.videoAssetId),
    )
    .leftJoin(media, eq(media.id, editorialVideoAssets.posterMediaId))
    .where(eq(contentVersionVideos.contentVersionId, contentVersionId))
    .orderBy(asc(contentVersionVideos.sortOrder));

  const renditionsByMediaId = await loadMediaRenditionsByMediaIds(
    rows
      .map((row) => row.posterMediaId)
      .filter((id): id is string => Boolean(id)),
  );

  return rows.map((row) => {
    const poster = resolveEditorVideoPoster({
      provider: row.asset.provider,
      providerVideoId: row.asset.providerVideoId,
      posterMediaId: row.asset.posterMediaId,
      posterRow: row.posterStorageKey
        ? {
            storageKey: row.posterStorageKey,
            width: row.posterWidth,
            height: row.posterHeight,
            renditions: row.posterMediaId
              ? renditionsByMediaId.get(row.posterMediaId)
              : undefined,
          }
        : null,
      mediaPublicBaseUrl,
    });
    return {
      id: row.asset.id,
      provider: row.asset.provider,
      providerVideoId: row.asset.providerVideoId,
      canonicalUrl: row.asset.canonicalUrl,
      title: row.asset.title,
      caption: row.relationCaption,
      assetCaption: row.asset.caption,
      durationSeconds: row.asset.durationSeconds,
      posterMediaId: row.asset.posterMediaId,
      posterPreviewUrl: poster.posterPreviewUrl,
      posterSource: poster.posterSource,
      rightsNote: row.asset.rightsNote,
      provenance: row.asset.provenance,
      sortOrder: row.sortOrder,
    };
  });
}

async function authorizeDraftVideoMutation(
  tx: PublishingTx,
  input: {
    contentItemId: string;
    versionId: string;
    expectedUpdatedAt: Date | string;
    scope: EditorStaffScope;
  },
) {
  const item = await lockContentItem(tx, input.contentItemId);
  unwrapPublishingDecision(assertContentNotDeleted(item.deletedAt));

  const [version] = await tx
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.id, input.versionId))
    .limit(1);

  if (!version) {
    throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_FOUND);
  }

  if (version.contentItemId !== item.id) {
    throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM);
  }

  const current = await loadLockedDisplayCategories(tx, item);
  unwrapPublishingDecision(
    decideLockedDraftSave({
      requestedVersionId: input.versionId,
      draftVersionId: item.draftVersionId,
      workflowStatus: version.workflowStatus,
      publishedVersionId: item.publishedVersionId,
      scheduledVersionId: item.scheduledVersionId,
      currentUpdatedAt: item.updatedAt,
      expectedUpdatedAt: input.expectedUpdatedAt,
      scope: input.scope,
      currentPrimaryCategoryId: current.primaryCategoryId,
      nextCategoryIds: current.categoryIds,
      nextPrimaryCategoryId: current.primaryCategoryId,
    }),
  );

  return { item, version };
}

async function assertVideoAssetsAvailable(
  tx: PublishingTx,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const rows = await tx
    .select({ id: editorialVideoAssets.id })
    .from(editorialVideoAssets)
    .where(inArray(editorialVideoAssets.id, ids));
  if (rows.length !== ids.length) {
    throw new VideoError(VIDEO_ERROR.NOT_FOUND);
  }
}

async function replaceVersionVideoRelations(
  tx: PublishingTx,
  contentVersionId: string,
  videos: readonly ContentVideoRelationInput[],
): Promise<void> {
  await tx
    .delete(contentVersionVideos)
    .where(eq(contentVersionVideos.contentVersionId, contentVersionId));
  await insertVersionVideoRelations(tx, contentVersionId, videos);
}

export async function setDraftVersionVideos(
  input: SetDraftVersionVideosInput,
): Promise<DraftVersionVideoResult> {
  const videos = canonicalizeDraftVideoItems(input.items);
  const db = getDb();

  return db.transaction(async (tx) => {
    const { item, version } = await authorizeDraftVideoMutation(tx, input);
    await assertVideoAssetsAvailable(
      tx,
      videos.map((entry) => entry.videoAssetId),
    );

    const beforeRelations = await loadVersionRelations(tx, version.id);
    const beforeVideos = await loadVersionVideoRelations(tx, version.id);
    await replaceVersionVideoRelations(tx, version.id, videos);
    const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt);
    const changeSet = buildDraftUpdateChangeSet({
      before: version,
      after: version,
      beforeRelations,
      afterRelations: beforeRelations,
      beforeVideos,
      afterVideos: videos,
    });

    await tx
      .update(contentItems)
      .set({ updatedAt: nextUpdatedAt })
      .where(eq(contentItems.id, item.id));

    if (changeSet) {
      await appendContentAuditEvent(tx, {
        contentItemId: item.id,
        versionId: version.id,
        eventType: CONTENT_AUDIT_EVENT_TYPE.DRAFT_UPDATED,
        actor: staffAuditActor(input.actorId),
        changeSet,
      });
    }

    return {
      contentItemId: item.id,
      versionId: version.id,
      updatedAt: nextUpdatedAt,
      videos: await loadVideoAttachments(tx, version.id, input.mediaPublicBaseUrl),
    };
  });
}
