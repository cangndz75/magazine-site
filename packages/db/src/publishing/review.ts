import { and, eq } from "drizzle-orm";
import {
  type EditorStaffScope,
  PUBLISHING_ERROR,
  PublishingError,
  REVIEW_EVENT_TYPE,
  WORKFLOW_STATUS,
  assertContentNotDeleted,
  canonicalizeOptionalReviewNote,
  canonicalizeRequiredReviewNote,
  decideApproveForReview,
  decideRequestChanges,
  decideSubmitForReview,
  nextMonotonicUpdatedAt,
  type PublishingDecision,
  type ReviewEventType,
  type WorkflowStatus,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";
import { contentReviewEvents } from "../schema/review-events";
import type { PublishingTx } from "./db-types";
import { rethrowPublishingDbError, unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";
import { authorizeLockedReviewTarget } from "./locked-scope";

export type ReviewResult = {
  contentItemId: string;
  versionId: string;
  workflowStatus: WorkflowStatus;
  draftVersionId: string;
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
      .select({
        id: contentVersions.id,
        contentItemId: contentVersions.contentItemId,
      })
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

async function appendReviewEvent(
  tx: PublishingTx,
  input: {
    contentItemId: string;
    contentVersionId: string;
    eventType: ReviewEventType;
    actorId: string;
    note: string | null;
  },
): Promise<void> {
  await tx.insert(contentReviewEvents).values({
    contentItemId: input.contentItemId,
    contentVersionId: input.contentVersionId,
    eventType: input.eventType,
    actorId: input.actorId,
    note: input.note,
  });
}

async function mutateReviewWorkflow(input: {
  contentItemId: string;
  versionId: string;
  expectedUpdatedAt: Date | string;
  scope: EditorStaffScope;
  actorId: string;
  note: string | null;
  eventType: ReviewEventType;
  nextWorkflowStatus: WorkflowStatus;
  decide: (locked: {
    contentItemId: string;
    versionContentItemId: string;
    draftVersionId: string | null;
    versionId: string;
    workflowStatus: WorkflowStatus;
    currentUpdatedAt: Date | string;
    expectedUpdatedAt: Date | string;
  }) => PublishingDecision<true>;
}): Promise<ReviewResult> {
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const item = await lockContentItem(tx, input.contentItemId);
      unwrapPublishingDecision(assertContentNotDeleted(item.deletedAt));
      const version = await loadOwnedVersion(tx, item.id, input.versionId);
      await authorizeLockedReviewTarget(tx, version.id, input.scope);
      unwrapPublishingDecision(
        input.decide({
          contentItemId: item.id,
          versionContentItemId: version.contentItemId,
          draftVersionId: item.draftVersionId,
          versionId: version.id,
          workflowStatus: version.workflowStatus,
          currentUpdatedAt: item.updatedAt,
          expectedUpdatedAt: input.expectedUpdatedAt,
        }),
      );

      const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt);

      await appendReviewEvent(tx, {
        contentItemId: item.id,
        contentVersionId: version.id,
        eventType: input.eventType,
        actorId: input.actorId,
        note: input.note,
      });

      await tx
        .update(contentVersions)
        .set({ workflowStatus: input.nextWorkflowStatus })
        .where(eq(contentVersions.id, version.id));

      await tx
        .update(contentItems)
        .set({ updatedAt: nextUpdatedAt })
        .where(eq(contentItems.id, item.id));

      return {
        contentItemId: item.id,
        versionId: version.id,
        workflowStatus: input.nextWorkflowStatus,
        draftVersionId: version.id,
        updatedAt: nextUpdatedAt,
      };
    });
  } catch (error) {
    rethrowPublishingDbError(error);
  }
}

export async function submitForReview(
  contentItemId: string,
  versionId: string,
  input: {
    expectedUpdatedAt: Date | string;
    scope: EditorStaffScope;
    actorId: string;
  },
): Promise<ReviewResult> {
  return mutateReviewWorkflow({
    contentItemId,
    versionId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    scope: input.scope,
    actorId: input.actorId,
    note: null,
    eventType: REVIEW_EVENT_TYPE.SUBMITTED,
    nextWorkflowStatus: WORKFLOW_STATUS.IN_REVIEW,
    decide: decideSubmitForReview,
  });
}

export async function approveVersion(
  contentItemId: string,
  versionId: string,
  input: {
    expectedUpdatedAt: Date | string;
    scope: EditorStaffScope;
    actorId: string;
    note?: string | null;
  },
): Promise<ReviewResult> {
  const note = unwrapPublishingDecision(
    canonicalizeOptionalReviewNote(input.note),
  );

  return mutateReviewWorkflow({
    contentItemId,
    versionId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    scope: input.scope,
    actorId: input.actorId,
    note,
    eventType: REVIEW_EVENT_TYPE.APPROVED,
    nextWorkflowStatus: WORKFLOW_STATUS.APPROVED,
    decide: decideApproveForReview,
  });
}

export async function requestChanges(
  contentItemId: string,
  versionId: string,
  input: {
    expectedUpdatedAt: Date | string;
    scope: EditorStaffScope;
    actorId: string;
    note: string;
  },
): Promise<ReviewResult> {
  const note = unwrapPublishingDecision(
    canonicalizeRequiredReviewNote(input.note),
  );

  return mutateReviewWorkflow({
    contentItemId,
    versionId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    scope: input.scope,
    actorId: input.actorId,
    note,
    eventType: REVIEW_EVENT_TYPE.CHANGES_REQUESTED,
    nextWorkflowStatus: WORKFLOW_STATUS.DRAFT,
    decide: decideRequestChanges,
  });
}
