import { eq } from "drizzle-orm";
import {
  PUBLISHING_ERROR,
  PublishingError,
  assertContentNotDeleted,
  decideReschedule,
  decideSchedule,
  decideUnschedule,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";
import { unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";
import { loadVersionRelations } from "./relations";

export type ScheduleResult = {
  contentItemId: string;
  scheduledVersionId: string;
  scheduledAt: Date;
  scheduleGeneration: number;
  draftVersionId: string | null;
};

export async function scheduleVersion(
  contentItemId: string,
  versionId: string,
  scheduledAt: Date,
  now: Date = new Date(),
): Promise<ScheduleResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    unwrapPublishingDecision(assertContentNotDeleted(item.deletedAt));

    const [version] = await tx
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.id, versionId))
      .limit(1);

    if (!version) {
      throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_FOUND);
    }

    const relations = await loadVersionRelations(tx, version.id);
    const plan = unwrapPublishingDecision(
      decideSchedule({
        item,
        version,
        categories: relations.categories ?? [],
        scheduledAt,
        now,
      }),
    );

    await tx
      .update(contentItems)
      .set({
        scheduledVersionId: plan.scheduledVersionId,
        scheduledAt: plan.scheduledAt,
        scheduleGeneration: plan.scheduleGeneration,
        draftVersionId: plan.draftVersionId,
        updatedAt: now,
      })
      .where(eq(contentItems.id, item.id));

    return {
      contentItemId: item.id,
      scheduledVersionId: plan.scheduledVersionId,
      scheduledAt: plan.scheduledAt,
      scheduleGeneration: plan.scheduleGeneration,
      draftVersionId: plan.draftVersionId,
    };
  });
}

export async function rescheduleVersion(
  contentItemId: string,
  scheduledAt: Date,
  now: Date = new Date(),
): Promise<ScheduleResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    const plan = unwrapPublishingDecision(decideReschedule({ item, scheduledAt, now }));

    await tx
      .update(contentItems)
      .set({
        scheduledAt: plan.scheduledAt,
        scheduleGeneration: plan.scheduleGeneration,
        updatedAt: now,
      })
      .where(eq(contentItems.id, item.id));

    return {
      contentItemId: item.id,
      scheduledVersionId: plan.scheduledVersionId,
      scheduledAt: plan.scheduledAt,
      scheduleGeneration: plan.scheduleGeneration,
      draftVersionId: plan.draftVersionId,
    };
  });
}

export async function unscheduleVersion(contentItemId: string): Promise<{
  contentItemId: string;
  scheduledVersionId: null;
  scheduledAt: null;
  scheduleGeneration: number;
}> {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    const plan = unwrapPublishingDecision(decideUnschedule(item));

    await tx
      .update(contentItems)
      .set({
        scheduledVersionId: plan.scheduledVersionId,
        scheduledAt: plan.scheduledAt,
        scheduleGeneration: plan.scheduleGeneration,
        updatedAt: now,
      })
      .where(eq(contentItems.id, item.id));

    return {
      contentItemId: item.id,
      scheduledVersionId: null,
      scheduledAt: null,
      scheduleGeneration: plan.scheduleGeneration,
    };
  });
}
