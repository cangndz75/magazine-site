import { and, eq } from "drizzle-orm";
import {
  PUBLISHING_ERROR,
  PublishingError,
  WORKFLOW_STATUS,
  assertCanApproveVersion,
  assertCanSubmitForReview,
  assertContentNotDeleted,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";
import type { PublishingTx } from "./db-types";
import { unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";

export type ReviewResult = {
  contentItemId: string;
  versionId: string;
  workflowStatus: typeof WORKFLOW_STATUS.IN_REVIEW | typeof WORKFLOW_STATUS.APPROVED;
  draftVersionId: string;
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

export async function submitForReview(
  contentItemId: string,
  versionId: string,
): Promise<ReviewResult> {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    unwrapPublishingDecision(assertContentNotDeleted(item.deletedAt));
    const version = await loadOwnedVersion(tx, item.id, versionId);

    unwrapPublishingDecision(
      assertCanSubmitForReview({
        contentItemId: item.id,
        versionContentItemId: version.contentItemId,
        draftVersionId: item.draftVersionId,
        versionId: version.id,
        workflowStatus: version.workflowStatus,
      }),
    );

    await tx
      .update(contentVersions)
      .set({ workflowStatus: WORKFLOW_STATUS.IN_REVIEW })
      .where(eq(contentVersions.id, version.id));

    await tx
      .update(contentItems)
      .set({ updatedAt: now })
      .where(eq(contentItems.id, item.id));

    return {
      contentItemId: item.id,
      versionId: version.id,
      workflowStatus: WORKFLOW_STATUS.IN_REVIEW,
      draftVersionId: version.id,
    };
  });
}

export async function approveVersion(
  contentItemId: string,
  versionId: string,
): Promise<ReviewResult> {
  const db = getDb();
  const now = new Date();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    unwrapPublishingDecision(assertContentNotDeleted(item.deletedAt));
    const version = await loadOwnedVersion(tx, item.id, versionId);

    unwrapPublishingDecision(
      assertCanApproveVersion({
        contentItemId: item.id,
        versionContentItemId: version.contentItemId,
        draftVersionId: item.draftVersionId,
        versionId: version.id,
        workflowStatus: version.workflowStatus,
      }),
    );

    await tx
      .update(contentVersions)
      .set({ workflowStatus: WORKFLOW_STATUS.APPROVED })
      .where(eq(contentVersions.id, version.id));

    await tx
      .update(contentItems)
      .set({ updatedAt: now })
      .where(eq(contentItems.id, item.id));

    return {
      contentItemId: item.id,
      versionId: version.id,
      workflowStatus: WORKFLOW_STATUS.APPROVED,
      draftVersionId: version.id,
    };
  });
}
