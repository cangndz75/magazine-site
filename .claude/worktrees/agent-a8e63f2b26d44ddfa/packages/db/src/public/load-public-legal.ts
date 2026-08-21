import { asc, and, eq, inArray } from "drizzle-orm";
import {
  CONTENT_LEGAL_ACTION_TYPE,
  hasPublicLegalWithdrawal,
  resolvePublicWithdrawalKind,
  toPublicLegalNotice,
  type PublicLegalNotice,
  type PublicWithdrawnArticleShell,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentLegalActions, contentVersions } from "../schema/content";

export async function loadPublicLegalNotices(
  contentItemId: string,
): Promise<PublicLegalNotice[]> {
  const db = getDb();
  const rows = await db
    .select({
      actionType: contentLegalActions.actionType,
      publicNote: contentLegalActions.publicNote,
      effectiveAt: contentLegalActions.effectiveAt,
    })
    .from(contentLegalActions)
    .where(
      and(
        eq(contentLegalActions.contentItemId, contentItemId),
        inArray(contentLegalActions.actionType, [
          CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
          CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
        ]),
      ),
    )
    .orderBy(
      asc(contentLegalActions.effectiveAt),
      asc(contentLegalActions.id),
    );

  const notices: PublicLegalNotice[] = [];
  for (const row of rows) {
    const notice = toPublicLegalNotice({
      actionType: row.actionType,
      publicNote: row.publicNote,
      effectiveAt: row.effectiveAt,
    });
    if (notice) {
      notices.push(notice);
    }
  }
  return notices;
}

export async function loadPublicWithdrawnArticleShellBySlug(
  slug: string,
): Promise<PublicWithdrawnArticleShell | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      publishedAt: contentItems.publishedAt,
      publishedVersionId: contentItems.publishedVersionId,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
      retractedActionId: contentItems.retractedActionId,
      takedownActionId: contentItems.takedownActionId,
      deletedAt: contentItems.deletedAt,
      title: contentVersions.title,
    })
    .from(contentItems)
    .innerJoin(
      contentVersions,
      eq(contentItems.publishedVersionId, contentVersions.id),
    )
    .where(eq(contentItems.slug, slug))
    .limit(1);

  if (!row || row.deletedAt !== null) {
    return null;
  }

  if (!hasPublicLegalWithdrawal(row)) {
    return null;
  }

  if (row.publishedAt === null || row.publishedVersionId === null) {
    return null;
  }

  const withdrawalActionId = row.takedownActionId ?? row.retractedActionId;
  if (!withdrawalActionId) {
    return null;
  }

  const [action] = await db
    .select({
      publicNote: contentLegalActions.publicNote,
      effectiveAt: contentLegalActions.effectiveAt,
    })
    .from(contentLegalActions)
    .where(eq(contentLegalActions.id, withdrawalActionId))
    .limit(1);

  if (!action) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    publishedAt: row.publishedAt,
    withdrawalKind: resolvePublicWithdrawalKind({
      retractedAt: row.retractedAt,
      takedownAt: row.takedownAt,
    }),
    publicNote: action.publicNote,
    effectiveAt: action.effectiveAt,
  };
}
