import { and, asc, eq, inArray } from "drizzle-orm";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  MEDIA_ROLE,
  PUBLISHING_ERROR,
  PublishingError,
  assertContentNotDeleted,
  assertGalleryAssignableMediaType,
  canonicalizeDraftGalleryItems,
  decideLockedDraftSave,
  nextMonotonicUpdatedAt,
  type CanonicalGalleryItem,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionMedia,
  contentVersions,
} from "../schema/content";
import { media } from "../schema/media";
import { unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";
import { loadLockedDisplayCategories } from "./locked-scope";
import {
  appendContentAuditEvent,
  buildDraftUpdateChangeSet,
  staffAuditActor,
} from "./audit";
import {
  loadVersionRelations,
  type ContentRelationInput,
} from "./relations";
import type { PublishingTx } from "./db-types";
import { formatEditorMediaLabel } from "../editor/media-label";
import {
  eligibilityForRow,
  previewUrlForRow,
} from "../editor/media-projections";
import { runAfterDraftGalleryReplaced } from "./test-hooks";
import type { ArticleEditorHeroAttachment } from "./draft-hero";

export type ArticleEditorGalleryAttachment = ArticleEditorHeroAttachment;

export type DraftVersionGalleryResult = {
  contentItemId: string;
  versionId: string;
  updatedAt: Date;
  gallery: ArticleEditorGalleryAttachment[];
};

export type SetDraftVersionGalleryInput = {
  contentItemId: string;
  versionId: string;
  expectedUpdatedAt: Date | string;
  items: readonly {
    mediaId: string;
    altText?: string | null;
    credit?: string | null;
    caption?: string | null;
  }[];
  scope: EditorStaffScope;
  actorId: string;
  mediaPublicBaseUrl: string | undefined;
};

async function loadGalleryAttachments(
  tx: PublishingTx,
  contentVersionId: string,
  mediaPublicBaseUrl: string | undefined,
): Promise<ArticleEditorGalleryAttachment[]> {
  const rows = await tx
    .select({
      mediaRow: media,
      role: contentVersionMedia.role,
      sortOrder: contentVersionMedia.sortOrder,
      caption: contentVersionMedia.caption,
      altText: contentVersionMedia.altText,
      credit: contentVersionMedia.credit,
    })
    .from(contentVersionMedia)
    .innerJoin(media, eq(media.id, contentVersionMedia.mediaId))
    .where(
      and(
        eq(contentVersionMedia.contentVersionId, contentVersionId),
        eq(contentVersionMedia.role, MEDIA_ROLE.GALLERY),
      ),
    )
    .orderBy(asc(contentVersionMedia.sortOrder));

  return rows.map((row) => ({
    id: row.mediaRow.id,
    label: formatEditorMediaLabel(row.mediaRow),
    mediaType: row.mediaRow.mediaType,
    width: row.mediaRow.width,
    height: row.mediaRow.height,
    role: row.role,
    sortOrder: row.sortOrder,
    caption: row.caption,
    altText: row.altText,
    credit: row.credit,
    previewUrl: previewUrlForRow(mediaPublicBaseUrl, row.mediaRow),
    creatorName: row.mediaRow.creatorName,
    creditLine: row.mediaRow.creditLine,
    eligibility: eligibilityForRow(row.mediaRow, new Date()),
  }));
}

function galleryAfterRelations(
  before: ContentRelationInput,
  gallery: readonly CanonicalGalleryItem[],
): ContentRelationInput {
  const nonGallery = (before.media ?? []).filter(
    (item) => item.role !== MEDIA_ROLE.GALLERY,
  );
  return {
    ...before,
    media: [
      ...nonGallery,
      ...gallery.map((item) => ({
        mediaId: item.mediaId,
        role: MEDIA_ROLE.GALLERY,
        sortOrder: item.sortOrder,
        caption: item.caption,
        altText: item.altText,
        credit: item.credit,
      })),
    ],
  };
}

async function authorizeDraftGalleryMutation(
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

async function replaceVersionGalleryRelations(
  tx: PublishingTx,
  contentVersionId: string,
  gallery: readonly CanonicalGalleryItem[],
): Promise<void> {
  await tx
    .delete(contentVersionMedia)
    .where(
      and(
        eq(contentVersionMedia.contentVersionId, contentVersionId),
        eq(contentVersionMedia.role, MEDIA_ROLE.GALLERY),
      ),
    );

  if (gallery.length > 0) {
    await tx.insert(contentVersionMedia).values(
      gallery.map((item) => ({
        contentVersionId,
        mediaId: item.mediaId,
        role: MEDIA_ROLE.GALLERY,
        sortOrder: item.sortOrder,
        caption: item.caption,
        altText: item.altText,
        credit: item.credit,
      })),
    );
  }

  await runAfterDraftGalleryReplaced({ contentVersionId });
}

export async function setDraftVersionGallery(
  input: SetDraftVersionGalleryInput,
): Promise<DraftVersionGalleryResult> {
  const gallery = unwrapPublishingDecision(
    canonicalizeDraftGalleryItems(input.items),
  );

  const db = getDb();

  return db.transaction(async (tx) => {
    const { item, version } = await authorizeDraftGalleryMutation(tx, input);

    const uniqueIds = [...new Set(gallery.map((entry) => entry.mediaId))];
    if (uniqueIds.length > 0) {
      const rows = await tx
        .select({ id: media.id, mediaType: media.mediaType })
        .from(media)
        .where(inArray(media.id, uniqueIds));

      if (rows.length !== uniqueIds.length) {
        throw new PublishingError(PUBLISHING_ERROR.RELATION_NOT_FOUND);
      }

      for (const row of rows) {
        unwrapPublishingDecision(assertGalleryAssignableMediaType(row.mediaType));
      }
    }

    const beforeRelations = await loadVersionRelations(tx, version.id);
    await replaceVersionGalleryRelations(tx, version.id, gallery);
    const afterRelations = galleryAfterRelations(beforeRelations, gallery);
    const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt);
    const changeSet = buildDraftUpdateChangeSet({
      before: version,
      after: version,
      beforeRelations,
      afterRelations,
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
      gallery: await loadGalleryAttachments(
        tx,
        version.id,
        input.mediaPublicBaseUrl,
      ),
    };
  });
}
