import { and, eq } from "drizzle-orm";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  MEDIA_ROLE,
  MEDIA_RENDITION_SURFACE,
  PUBLISHING_ERROR,
  PublishingError,
  assertContentNotDeleted,
  assertHeroAssignableMediaType,
  canonicalizeHeroAltText,
  canonicalizeHeroCredit,
  decideLockedDraftSave,
  nextMonotonicUpdatedAt,
  type EditorStaffScope,
  type MediaRole,
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
import { loadMediaRenditionsByMediaIds } from "../media/image-delivery";
import {
  eligibilityForRow,
  previewUrlForImageSurface,
} from "../editor/media-projections";
import { runAfterDraftHeroReplaced } from "./test-hooks";

export type ArticleEditorHeroAttachment = {
  id: string;
  label: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  role: MediaRole;
  sortOrder: number;
  caption: string | null;
  altText: string | null;
  credit: string | null;
  previewUrl: string | null;
  creatorName: string | null;
  creditLine: string | null;
  eligibility: ReturnType<typeof eligibilityForRow>;
};

export type DraftVersionHeroResult = {
  contentItemId: string;
  versionId: string;
  updatedAt: Date;
  hero: ArticleEditorHeroAttachment | null;
};

export type SetDraftVersionHeroInput = {
  contentItemId: string;
  versionId: string;
  expectedUpdatedAt: Date | string;
  mediaId: string;
  altText?: string | null;
  credit?: string | null;
  scope: EditorStaffScope;
  actorId: string;
  mediaPublicBaseUrl: string | undefined;
};

export type RemoveDraftVersionHeroInput = {
  contentItemId: string;
  versionId: string;
  expectedUpdatedAt: Date | string;
  scope: EditorStaffScope;
  actorId: string;
};

async function loadHeroAttachment(
  tx: PublishingTx,
  contentVersionId: string,
  mediaPublicBaseUrl: string | undefined,
): Promise<ArticleEditorHeroAttachment | null> {
  const [row] = await tx
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
        eq(contentVersionMedia.role, MEDIA_ROLE.HERO),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const renditionsByMediaId = await loadMediaRenditionsByMediaIds([row.mediaRow.id]);

  return {
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
    previewUrl: previewUrlForImageSurface({
      mediaPublicBaseUrl,
      originalStorageKey: row.mediaRow.storageKey,
      originalWidth: row.mediaRow.width,
      originalHeight: row.mediaRow.height,
      renditions: renditionsByMediaId.get(row.mediaRow.id),
      surface: MEDIA_RENDITION_SURFACE.ARTICLE_HERO,
    }),
    creatorName: row.mediaRow.creatorName,
    creditLine: row.mediaRow.creditLine,
    eligibility: eligibilityForRow(row.mediaRow, new Date()),
  };
}

function heroAfterRelations(
  before: ContentRelationInput,
  hero: {
    mediaId: string;
    altText: string | null;
    credit: string | null;
    caption: string | null;
  } | null,
): ContentRelationInput {
  const nonHero = (before.media ?? []).filter(
    (item) => item.role !== MEDIA_ROLE.HERO,
  );
  if (!hero) {
    return { ...before, media: nonHero };
  }
  return {
    ...before,
    media: [
      {
        mediaId: hero.mediaId,
        role: MEDIA_ROLE.HERO,
        sortOrder: 0,
        caption: hero.caption,
        altText: hero.altText,
        credit: hero.credit,
      },
      ...nonHero,
    ],
  };
}

async function authorizeDraftHeroMutation(
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

async function replaceVersionHeroRelation(
  tx: PublishingTx,
  contentVersionId: string,
  hero: {
    mediaId: string;
    altText: string | null;
    credit: string | null;
    caption: string | null;
  } | null,
): Promise<void> {
  await tx
    .delete(contentVersionMedia)
    .where(
      and(
        eq(contentVersionMedia.contentVersionId, contentVersionId),
        eq(contentVersionMedia.role, MEDIA_ROLE.HERO),
      ),
    );

  if (hero) {
    await tx.insert(contentVersionMedia).values({
      contentVersionId,
      mediaId: hero.mediaId,
      role: MEDIA_ROLE.HERO,
      sortOrder: 0,
      caption: hero.caption,
      altText: hero.altText,
      credit: hero.credit,
    });
  }

  await runAfterDraftHeroReplaced({ contentVersionId });
}

export async function setDraftVersionHero(
  input: SetDraftVersionHeroInput,
): Promise<DraftVersionHeroResult> {
  const altText = unwrapPublishingDecision(canonicalizeHeroAltText(input.altText));
  const credit = unwrapPublishingDecision(canonicalizeHeroCredit(input.credit));

  const db = getDb();

  return db.transaction(async (tx) => {
    const { item, version } = await authorizeDraftHeroMutation(tx, input);

    const [mediaRow] = await tx
      .select()
      .from(media)
      .where(eq(media.id, input.mediaId))
      .limit(1);

    if (!mediaRow) {
      throw new PublishingError(PUBLISHING_ERROR.RELATION_NOT_FOUND);
    }

    unwrapPublishingDecision(assertHeroAssignableMediaType(mediaRow.mediaType));

    const beforeRelations = await loadVersionRelations(tx, version.id);
    const existingHero = (beforeRelations.media ?? []).find(
      (item) => item.role === MEDIA_ROLE.HERO,
    );
    const heroPayload = {
      mediaId: input.mediaId,
      altText,
      credit,
      caption:
        existingHero?.mediaId === input.mediaId
          ? (existingHero.caption ?? null)
          : null,
    };

    await replaceVersionHeroRelation(tx, version.id, heroPayload);

    const afterRelations = heroAfterRelations(beforeRelations, heroPayload);
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

    const hero = await loadHeroAttachment(
      tx,
      version.id,
      input.mediaPublicBaseUrl,
    );

    return {
      contentItemId: item.id,
      versionId: version.id,
      updatedAt: nextUpdatedAt,
      hero,
    };
  });
}

export async function removeDraftVersionHero(
  input: RemoveDraftVersionHeroInput,
): Promise<DraftVersionHeroResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const { item, version } = await authorizeDraftHeroMutation(tx, input);

    const beforeRelations = await loadVersionRelations(tx, version.id);
    const hadHero = (beforeRelations.media ?? []).some(
      (item) => item.role === MEDIA_ROLE.HERO,
    );

    if (!hadHero) {
      return {
        contentItemId: item.id,
        versionId: version.id,
        updatedAt: item.updatedAt,
        hero: null,
      };
    }

    await replaceVersionHeroRelation(tx, version.id, null);

    const afterRelations = heroAfterRelations(beforeRelations, null);
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
      hero: null,
    };
  });
}
