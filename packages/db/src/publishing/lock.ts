import { eq } from "drizzle-orm";
import { PUBLISHING_ERROR, PublishingError } from "@magazine/domain";
import { contentItems } from "../schema/content";
import type { PublishingTx } from "./db-types";

export async function lockContentItem(tx: PublishingTx, contentItemId: string) {
  const [row] = await tx
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId))
    .for("update");

  if (!row) {
    throw new PublishingError(PUBLISHING_ERROR.CONTENT_NOT_FOUND);
  }

  return row;
}
