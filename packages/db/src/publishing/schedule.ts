import { eq } from "drizzle-orm";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  PUBLISHING_ERROR,
  PublishingError,
  assertContentNotDeleted,
  decideReschedule,
  decideSchedule,
  decideUnschedule,
  nextMonotonicUpdatedAt,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";
import { unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";
import {
  authorizeLockedEditorMutation,
  loadLockedVersionCategories,
} from "./locked-scope";
import { loadVersionRelations } from "./relations";
import { appendContentAuditEvent, staffAuditActor } from "./audit";

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
  scope: EditorStaffScope,
  actorId: string,
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

    const target = await loadLockedVersionCategories(tx, version.id);
    await authorizeLockedEditorMutation(tx, item, scope, {
      categoryIds: target.categoryIds,
    });

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

    const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt, now);

    await tx
      .update(contentItems)
      .set({
        scheduledVersionId: plan.scheduledVersionId,
        scheduledAt: plan.scheduledAt,
        scheduleGeneration: plan.scheduleGeneration,
        draftVersionId: plan.draftVersionId,
        updatedAt: nextUpdatedAt,
      })
      .where(eq(contentItems.id, item.id));

    await appendContentAuditEvent(tx, {
      contentItemId: item.id,
      versionId: plan.scheduledVersionId,
      eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_SCHEDULED,
      actor: staffAuditActor(actorId),
    });

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
  scope: EditorStaffScope,
  actorId: string,
  now: Date = new Date(),
): Promise<ScheduleResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    const scheduled = await loadLockedVersionCategories(
      tx,
      item.scheduledVersionId,
    );
    await authorizeLockedEditorMutation(tx, item, scope, {
      categoryIds: scheduled.categoryIds,
    });
    const plan = unwrapPublishingDecision(
      decideReschedule({ item, scheduledAt, now }),
    );

    const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt, now);

    await tx
      .update(contentItems)
      .set({
        scheduledAt: plan.scheduledAt,
        scheduleGeneration: plan.scheduleGeneration,
        updatedAt: nextUpdatedAt,
      })
      .where(eq(contentItems.id, item.id));

    await appendContentAuditEvent(tx, {
      contentItemId: item.id,
      versionId: plan.scheduledVersionId,
      eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_RESCHEDULED,
      actor: staffAuditActor(actorId),
    });

    return {
      contentItemId: item.id,
      scheduledVersionId: plan.scheduledVersionId,
      scheduledAt: plan.scheduledAt,
      scheduleGeneration: plan.scheduleGeneration,
      draftVersionId: plan.draftVersionId,
    };
  });
}

export async function unscheduleVersion(
  contentItemId: string,
  scope: EditorStaffScope,
  actorId: string,
): Promise<{
  contentItemId: string;
  scheduledVersionId: null;
  scheduledAt: null;
  scheduleGeneration: number;
}> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    const scheduled = await loadLockedVersionCategories(
      tx,
      item.scheduledVersionId,
    );
    await authorizeLockedEditorMutation(tx, item, scope, {
      categoryIds: scheduled.categoryIds,
    });
    const plan = unwrapPublishingDecision(decideUnschedule(item));
    const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt);

    await tx
      .update(contentItems)
      .set({
        scheduledVersionId: plan.scheduledVersionId,
        scheduledAt: plan.scheduledAt,
        scheduleGeneration: plan.scheduleGeneration,
        updatedAt: nextUpdatedAt,
      })
      .where(eq(contentItems.id, item.id));

    await appendContentAuditEvent(tx, {
      contentItemId: item.id,
      versionId: item.scheduledVersionId,
      eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_SCHEDULE_CANCELLED,
      actor: staffAuditActor(actorId),
    });

    return {
      contentItemId: item.id,
      scheduledVersionId: null,
      scheduledAt: null,
      scheduleGeneration: plan.scheduleGeneration,
    };
  });
}
