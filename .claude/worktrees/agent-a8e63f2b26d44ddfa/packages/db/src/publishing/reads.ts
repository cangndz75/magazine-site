import { eq } from "drizzle-orm";
import {
  PUBLISHING_ERROR,
  PublishingError,
  assertVersionEditable,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";
import { unwrapPublishingDecision } from "./errors";

export async function getContentItem(contentItemId: string) {
  const db = getDb();
  const [item] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId))
    .limit(1);

  if (!item) {
    throw new PublishingError(PUBLISHING_ERROR.CONTENT_NOT_FOUND);
  }

  return item;
}

export async function getContentVersion(versionId: string) {
  const db = getDb();
  const [version] = await db
    .select()
    .from(contentVersions)
    .where(eq(contentVersions.id, versionId))
    .limit(1);

  if (!version) {
    throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_FOUND);
  }

  return version;
}

/**
 * Future update-content services must call this before mutating a version.
 * Only DRAFT versions that are not published or scheduled may be edited.
 */
export async function assertEditableVersion(
  contentItemId: string,
  versionId: string,
): Promise<void> {
  const item = await getContentItem(contentItemId);
  const version = await getContentVersion(versionId);

  if (version.contentItemId !== item.id) {
    throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM);
  }

  unwrapPublishingDecision(
    assertVersionEditable({
      versionId: version.id,
      workflowStatus: version.workflowStatus,
      publishedVersionId: item.publishedVersionId,
      scheduledVersionId: item.scheduledVersionId,
    }),
  );
}
