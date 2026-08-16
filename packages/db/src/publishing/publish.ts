import { and, eq } from "drizzle-orm";
import {
  PUBLISHING_ERROR,
  PublishingError,
  PUBLICATION_STATUS,
  SCHEDULED_PUBLISH_DECISION,
  assertContentNotDeleted,
  decidePublish,
  decideScheduledPublishExecution,
  decideUnpublish,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";
import type { PublishingTx } from "./db-types";
import { unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";
import { loadVersionRelations } from "./relations";

export type PublishResult = {
  contentItemId: string;
  publishedVersionId: string;
  publicationStatus: typeof PUBLICATION_STATUS.PUBLISHED;
  publishedAt: Date;
  publicDateModified: Date;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: Date | null;
  scheduleGeneration: number;
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
): Promise<PublishResult> {
  const version = await loadOwnedVersion(tx, item.id, versionId);
  const relations = await loadVersionRelations(tx, version.id);
  const plan = unwrapPublishingDecision(
    decidePublish({
      item,
      version,
      categories: relations.categories ?? [],
      now,
    }),
  );

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
      updatedAt: now,
    })
    .where(eq(contentItems.id, item.id));

  return {
    contentItemId: item.id,
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
  };
}

export async function publishVersion(
  contentItemId: string,
  versionId: string,
  now: Date = new Date(),
): Promise<PublishResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    unwrapPublishingDecision(assertContentNotDeleted(item.deletedAt));
    return publishLockedVersion(tx, item, versionId, now);
  });
}

/**
 * UNPUBLISH does not unschedule. A future scheduled version remains scheduled.
 * Historical publishedVersionId / publishedAt / publicDateModified are preserved.
 */
export async function unpublishContent(contentItemId: string): Promise<{
  contentItemId: string;
  publicationStatus: typeof PUBLICATION_STATUS.UNPUBLISHED;
  publishedVersionId: string | null;
  publishedAt: Date | null;
  publicDateModified: Date | null;
  scheduledVersionId: string | null;
  scheduledAt: Date | null;
}> {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    unwrapPublishingDecision(decideUnpublish(item));

    await tx
      .update(contentItems)
      .set({
        publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
        updatedAt: now,
      })
      .where(eq(contentItems.id, item.id));

    return {
      contentItemId: item.id,
      publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
      publishedVersionId: item.publishedVersionId,
      publishedAt: item.publishedAt,
      publicDateModified: item.publicDateModified,
      scheduledVersionId: item.scheduledVersionId,
      scheduledAt: item.scheduledAt,
    };
  });
}

export type ScheduledPublishExecutionResult =
  | { outcome: typeof SCHEDULED_PUBLISH_DECISION.NOOP_STALE }
  | { outcome: typeof SCHEDULED_PUBLISH_DECISION.NOOP_NOT_SCHEDULED }
  | { outcome: typeof SCHEDULED_PUBLISH_DECISION.NOOP_NOT_DUE }
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
    });

    if (decision.decision !== SCHEDULED_PUBLISH_DECISION.EXECUTE) {
      return { outcome: decision.decision };
    }

    const publish = await publishLockedVersion(tx, item, decision.versionId, now);
    return {
      outcome: SCHEDULED_PUBLISH_DECISION.EXECUTE,
      publish,
    };
  });
}
