import { asc, eq } from "drizzle-orm";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  ContentLegalError,
  CONTENT_LEGAL_ERROR,
  authorizeContentLegalMutation,
  contentLegalAuditEventType,
  decideContentLegalAction,
  nextMonotonicUpdatedAt,
  type ContentLegalActionPolarity,
  type ContentLegalActionType,
  type ContentLegalReasonCategory,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import { enqueuePublicArticleCacheInvalidation } from "../public-cache-outbox";
import { contentItems, contentLegalActions } from "../schema/content";
import { lockContentItem } from "./lock";
import { authorizeLockedEditorMutation } from "./locked-scope";
import { appendContentAuditEvent, staffAuditActor } from "./audit";

export type RecordContentLegalActionInput = {
  contentItemId: string;
  actionType: string;
  polarity?: string;
  reasonCategory: string;
  internalNote: string;
  publicNote?: string | null;
  effectiveAt?: Date | string | null;
  expectedUpdatedAt: Date | string;
  scope: EditorStaffScope;
  actorId: string;
  now?: Date;
};

export type ContentLegalActionRecord = {
  id: string;
  contentItemId: string;
  contentVersionId: string | null;
  actionType: ContentLegalActionType;
  polarity: ContentLegalActionPolarity;
  reasonCategory: ContentLegalReasonCategory;
  internalNote: string;
  publicNote: string | null;
  actorStaffUserId: string;
  createdAt: Date;
  effectiveAt: Date;
};

export type RecordContentLegalActionResult = {
  action: ContentLegalActionRecord;
  publicationStatus: string;
  publishedVersionId: string | null;
  publishedAt: Date | null;
  legalHoldAt: Date | null;
  legalHoldReason: string | null;
  retractedAt: Date | null;
  takedownAt: Date | null;
  updatedAt: Date;
};

function unwrapLegal<T>(
  decision: { ok: true; value: T } | { ok: false; code: string },
): T {
  if (!decision.ok) {
    throw new ContentLegalError(decision.code as never);
  }
  return decision.value;
}

export async function recordContentLegalAction(
  input: RecordContentLegalActionInput,
): Promise<RecordContentLegalActionResult> {
  unwrapLegal(authorizeContentLegalMutation({ roles: input.scope.roles }));
  const now = input.now ?? new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, input.contentItemId);
    await authorizeLockedEditorMutation(tx, item, input.scope);

    const plan = unwrapLegal(
      decideContentLegalAction({
        item: {
          deletedAt: item.deletedAt,
          publicationStatus: item.publicationStatus,
          publishedVersionId: item.publishedVersionId,
          publishedAt: item.publishedAt,
          legalHoldAt: item.legalHoldAt,
          legalHoldReason: item.legalHoldReason,
          retractedAt: item.retractedAt,
          takedownAt: item.takedownAt,
          updatedAt: item.updatedAt,
        },
        write: {
          actionType: input.actionType,
          polarity: input.polarity,
          reasonCategory: input.reasonCategory,
          internalNote: input.internalNote,
          publicNote: input.publicNote,
          effectiveAt: input.effectiveAt,
          expectedUpdatedAt: input.expectedUpdatedAt,
        },
        now,
      }),
    );

    const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt, now);
    const contentVersionId =
      item.publishedVersionId ?? item.draftVersionId ?? item.scheduledVersionId;

    const [inserted] = await tx
      .insert(contentLegalActions)
      .values({
        contentItemId: item.id,
        contentVersionId,
        actionType: plan.actionType,
        polarity: plan.polarity,
        reasonCategory: plan.reasonCategory,
        internalNote: plan.internalNote,
        publicNote: plan.publicNote,
        actorStaffUserId: input.actorId,
        createdAt: now,
        effectiveAt: plan.effectiveAt,
      })
      .returning();

    if (!inserted) {
      throw new ContentLegalError(CONTENT_LEGAL_ERROR.INVALID_LEGAL_ACTION);
    }

    await tx
      .update(contentItems)
      .set({
        legalHoldAt: plan.nextLegalHoldAt,
        legalHoldReason: plan.nextLegalHoldReason,
        legalHoldActionId:
          plan.nextLegalHoldAt === null
            ? null
            : (item.legalHoldActionId ?? inserted.id),
        retractedAt: plan.nextRetractedAt,
        retractedActionId:
          plan.nextRetractedAt === null
            ? null
            : (item.retractedActionId ?? inserted.id),
        takedownAt: plan.nextTakedownAt,
        takedownActionId:
          plan.nextTakedownAt === null
            ? null
            : (item.takedownActionId ?? inserted.id),
        updatedAt: nextUpdatedAt,
      })
      .where(eq(contentItems.id, item.id));

    const eventType = contentLegalAuditEventType(plan);
    await appendContentAuditEvent(tx, {
      contentItemId: item.id,
      versionId: contentVersionId,
      eventType: CONTENT_AUDIT_EVENT_TYPE[eventType],
      actor: staffAuditActor(input.actorId),
      changeSet: {
        legalAction: {
          actionId: inserted.id,
          actionType: plan.actionType,
          polarity: plan.polarity,
          reasonCategory: plan.reasonCategory,
          hasPublicNote: plan.publicNote !== null,
        },
      },
    });

    if (plan.invalidatesPublicCache) {
      await enqueuePublicArticleCacheInvalidation(tx, {
        contentItemId: item.id,
        slug: item.slug,
        now,
      });
    }

    return {
      action: {
        id: inserted.id,
        contentItemId: inserted.contentItemId,
        contentVersionId: inserted.contentVersionId,
        actionType: inserted.actionType,
        polarity: inserted.polarity,
        reasonCategory: inserted.reasonCategory,
        internalNote: inserted.internalNote,
        publicNote: inserted.publicNote,
        actorStaffUserId: inserted.actorStaffUserId,
        createdAt: inserted.createdAt,
        effectiveAt: inserted.effectiveAt,
      },
      publicationStatus: item.publicationStatus,
      publishedVersionId: item.publishedVersionId,
      publishedAt: item.publishedAt,
      legalHoldAt: plan.nextLegalHoldAt,
      legalHoldReason: plan.nextLegalHoldReason,
      retractedAt: plan.nextRetractedAt,
      takedownAt: plan.nextTakedownAt,
      updatedAt: nextUpdatedAt,
    };
  });
}

export async function listContentLegalActions(
  contentItemId: string,
): Promise<ContentLegalActionRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(contentLegalActions)
    .where(eq(contentLegalActions.contentItemId, contentItemId))
    .orderBy(asc(contentLegalActions.createdAt), asc(contentLegalActions.id));

  return rows.map((row) => ({
    id: row.id,
    contentItemId: row.contentItemId,
    contentVersionId: row.contentVersionId,
    actionType: row.actionType,
    polarity: row.polarity,
    reasonCategory: row.reasonCategory,
    internalNote: row.internalNote,
    publicNote: row.publicNote,
    actorStaffUserId: row.actorStaffUserId,
    createdAt: row.createdAt,
    effectiveAt: row.effectiveAt,
  }));
}
