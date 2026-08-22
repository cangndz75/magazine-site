import { and, eq, inArray } from "drizzle-orm";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  CONTENT_KIND,
  MEDIA_ROLE,
  MEDIA_TYPE,
  PUBLISHING_ERROR,
  PublishingError,
  PUBLICATION_STATUS,
  SCHEDULED_PUBLISH_DECISION,
  assertGalleryPublishReadiness,
  assertContentNotDeleted,
  decidePublish,
  decideScheduledPublishExecution,
  decideUnpublish,
  evaluateMediaPublicEligibility,
  nextMonotonicUpdatedAt,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import { enqueuePublicArticleCacheInvalidation } from "../public-cache-outbox";
import { enqueuePublicEntityRelatedInvalidationForVersion } from "../entities/cache-invalidation";
import {
  contentItems,
  contentVersionMedia,
  contentVersions,
} from "../schema/content";
import { media } from "../schema/media";
import type { PublishingTx } from "./db-types";
import { unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";
import { assertLockedEditorialMutationAllowed } from "./legal-hold-guard";
import {
  authorizeLockedEditorMutation,
  loadLockedVersionCategories,
} from "./locked-scope";
import { loadVersionRelations } from "./relations";
import {
  SYSTEM_AUDIT_ACTOR,
  appendContentAuditEvent,
  staffAuditActor,
  type AuditActorInput,
} from "./audit";

export type PublishResult = {
  contentItemId: string;
  slug: string;
  publishedVersionId: string;
  publicationStatus: typeof PUBLICATION_STATUS.PUBLISHED;
  publishedAt: Date;
  publicDateModified: Date;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: Date | null;
  scheduleGeneration: number;
  updatedAt: Date;
};

export type UnpublishResult = {
  contentItemId: string;
  slug: string;
  publicationStatus: typeof PUBLICATION_STATUS.UNPUBLISHED;
  publishedVersionId: string | null;
  publishedAt: Date | null;
  publicDateModified: Date | null;
  scheduledVersionId: string | null;
  scheduledAt: Date | null;
  updatedAt: Date;
};

async function loadOwnedVersion(
  tx: PublishingTx,
  contentItemId: string,
  versionId: string,
) {
  const [version] = await tx
    .select()
    .from(contentVersions)
    .where(
      and(
        eq(contentVersions.id, versionId),
        eq(contentVersions.contentItemId, contentItemId),
      ),
    )
    .limit(1);

  if (!version) {
    const [anyVersion] = await tx
      .select({ id: contentVersions.id })
      .from(contentVersions)
      .where(eq(contentVersions.id, versionId))
      .limit(1);

    if (!anyVersion) {
      throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_FOUND);
    }

    throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM);
  }

  return version;
}

async function publishLockedVersion(
  tx: PublishingTx,
  item: Awaited<ReturnType<typeof lockContentItem>>,
  versionId: string,
  now: Date,
  actor: AuditActorInput,
): Promise<PublishResult> {
  const version = await loadOwnedVersion(tx, item.id, versionId);
  const relations = await loadVersionRelations(tx, version.id);
  await assertGalleryReadyForPublic(tx, item.contentKind, version.id, now);
  const plan = unwrapPublishingDecision(
    decidePublish({
      item,
      version,
      categories: relations.categories ?? [],
      now,
    }),
  );

  const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt, now);

  await tx
    .update(contentItems)
    .set({
      publicationStatus: plan.publicationStatus,
      publishedVersionId: plan.publishedVersionId,
      publishedAt: plan.publishedAt,
      publicDateModified: plan.publicDateModified,
      draftVersionId: plan.draftVersionId,
      scheduledVersionId: plan.scheduledVersionId,
      scheduledAt:
        plan.scheduledAt instanceof Date || plan.scheduledAt === null
          ? plan.scheduledAt
          : new Date(plan.scheduledAt),
      scheduleGeneration: plan.scheduleGeneration,
      updatedAt: nextUpdatedAt,
    })
    .where(eq(contentItems.id, item.id));

  await appendContentAuditEvent(tx, {
    contentItemId: item.id,
    versionId: plan.publishedVersionId,
    eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_PUBLISHED,
    actor,
  });
  await enqueuePublicArticleCacheInvalidation(tx, {
    contentItemId: item.id,
    slug: item.slug,
    now,
  });
  await enqueuePublicEntityRelatedInvalidationForVersion(tx, plan.publishedVersionId, now);

  return {
    contentItemId: item.id,
    slug: item.slug,
    publishedVersionId: plan.publishedVersionId,
    publicationStatus: plan.publicationStatus,
    publishedAt: plan.publishedAt,
    publicDateModified: plan.publicDateModified,
    draftVersionId: plan.draftVersionId,
    scheduledVersionId: plan.scheduledVersionId,
    scheduledAt:
      plan.scheduledAt instanceof Date
        ? plan.scheduledAt
        : plan.scheduledAt
          ? new Date(plan.scheduledAt)
          : null,
    scheduleGeneration: plan.scheduleGeneration,
    updatedAt: nextUpdatedAt,
  };
}

async function assertGalleryReadyForPublic(
  tx: PublishingTx,
  contentKind: string,
  versionId: string,
  now: Date,
): Promise<void> {
  if (contentKind !== CONTENT_KIND.GALLERY) {
    return;
  }

  const rows = await tx
    .select({
      role: contentVersionMedia.role,
      mediaType: media.mediaType,
      sourceKind: media.sourceKind,
      sourceName: media.sourceName,
      creatorName: media.creatorName,
      rightsHolder: media.rightsHolder,
      licenseType: media.licenseType,
      licenseReference: media.licenseReference,
      licenseNote: media.licenseNote,
      licenseStartsAt: media.licenseStartsAt,
      licenseExpiresAt: media.licenseExpiresAt,
      creditLine: media.creditLine,
      usageRestriction: media.usageRestriction,
      territoryRestriction: media.territoryRestriction,
    })
    .from(contentVersionMedia)
    .innerJoin(media, eq(media.id, contentVersionMedia.mediaId))
    .where(
      and(
        eq(contentVersionMedia.contentVersionId, versionId),
        inArray(contentVersionMedia.role, [MEDIA_ROLE.HERO, MEDIA_ROLE.GALLERY]),
      ),
    );

  let heroImageCount = 0;
  let galleryImageCount = 0;
  let blockedPublicMediaCount = 0;

  for (const row of rows) {
    if (row.mediaType !== MEDIA_TYPE.IMAGE) {
      blockedPublicMediaCount += 1;
      continue;
    }
    if (row.role === MEDIA_ROLE.HERO) {
      heroImageCount += 1;
    }
    if (row.role === MEDIA_ROLE.GALLERY) {
      galleryImageCount += 1;
    }
    const eligibility = evaluateMediaPublicEligibility(row, now);
    if (!eligibility.eligible) {
      blockedPublicMediaCount += 1;
    }
  }

  unwrapPublishingDecision(
    assertGalleryPublishReadiness({
      contentKind,
      heroImageCount,
      galleryImageCount,
      blockedPublicMediaCount,
    }),
  );
}

export async function publishVersion(
  contentItemId: string,
  versionId: string,
  scope: EditorStaffScope,
  actorId: string,
  now: Date = new Date(),
): Promise<PublishResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    assertLockedEditorialMutationAllowed(item);
    const target = await loadLockedVersionCategories(tx, versionId);
    await authorizeLockedEditorMutation(tx, item, scope, {
      categoryIds: target.categoryIds,
    });
    return publishLockedVersion(
      tx,
      item,
      versionId,
      now,
      staffAuditActor(actorId),
    );
  });
}

/**
 * UNPUBLISH does not unschedule. A future scheduled version remains scheduled.
 * Historical publishedVersionId / publishedAt / publicDateModified are preserved.
 */
export async function unpublishContent(
  contentItemId: string,
  scope: EditorStaffScope,
  actorId: string,
): Promise<UnpublishResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    assertLockedEditorialMutationAllowed(item);
    const published = await loadLockedVersionCategories(tx, item.publishedVersionId);
    await authorizeLockedEditorMutation(tx, item, scope, {
      categoryIds: published.categoryIds,
    });
    unwrapPublishingDecision(decideUnpublish(item));

    const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt);

    await tx
      .update(contentItems)
      .set({
        publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
        updatedAt: nextUpdatedAt,
      })
      .where(eq(contentItems.id, item.id));

    await appendContentAuditEvent(tx, {
      contentItemId: item.id,
      versionId: item.publishedVersionId,
      eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_UNPUBLISHED,
      actor: staffAuditActor(actorId),
    });
    await enqueuePublicArticleCacheInvalidation(tx, {
      contentItemId: item.id,
      slug: item.slug,
    });
    if (item.publishedVersionId) {
      await enqueuePublicEntityRelatedInvalidationForVersion(
        tx,
        item.publishedVersionId,
      );
    }

    return {
      contentItemId: item.id,
      slug: item.slug,
      publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
      publishedVersionId: item.publishedVersionId,
      publishedAt: item.publishedAt,
      publicDateModified: item.publicDateModified,
      scheduledVersionId: item.scheduledVersionId,
      scheduledAt: item.scheduledAt,
      updatedAt: nextUpdatedAt,
    };
  });
}

export type ScheduledPublishExecutionResult =
  | { outcome: typeof SCHEDULED_PUBLISH_DECISION.NOOP_STALE }
  | { outcome: typeof SCHEDULED_PUBLISH_DECISION.NOOP_NOT_SCHEDULED }
  | { outcome: typeof SCHEDULED_PUBLISH_DECISION.NOOP_NOT_DUE }
  | { outcome: typeof SCHEDULED_PUBLISH_DECISION.NOOP_LEGAL_HOLD }
  | { outcome: typeof SCHEDULED_PUBLISH_DECISION.EXECUTE; publish: PublishResult };

export async function executeScheduledPublish(
  contentItemId: string,
  jobGeneration: number,
  now: Date = new Date(),
): Promise<ScheduledPublishExecutionResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    unwrapPublishingDecision(assertContentNotDeleted(item.deletedAt));

    const decision = decideScheduledPublishExecution({
      jobGeneration,
      currentGeneration: item.scheduleGeneration,
      scheduledVersionId: item.scheduledVersionId,
      scheduledAt: item.scheduledAt,
      now,
      legalHoldAt: item.legalHoldAt,
      retractedAt: item.retractedAt,
      takedownAt: item.takedownAt,
    });

    if (decision.decision !== SCHEDULED_PUBLISH_DECISION.EXECUTE) {
      return { outcome: decision.decision };
    }

    const publish = await publishLockedVersion(
      tx,
      item,
      decision.versionId,
      now,
      SYSTEM_AUDIT_ACTOR,
    );
    return {
      outcome: SCHEDULED_PUBLISH_DECISION.EXECUTE,
      publish,
    };
  });
}
