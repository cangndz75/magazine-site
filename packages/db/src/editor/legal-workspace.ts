import { and, desc, eq, gte, ilike, isNotNull, isNull, lt, lte, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  encodeEditorListCursor,
  type ContentLegalActionPolarity,
  type ContentLegalActionType,
  type ContentLegalReasonCategory,
  type EditorListCursor,
  type PublicationStatus,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentLegalActions,
  contentVersions,
} from "../schema/content";
import { staffUsers } from "../schema/staff";

const publishedVersion = alias(contentVersions, "legal_published_version");

export type LegalDashboardFilters = {
  actionType?: ContentLegalActionType;
  search?: string;
  activeHoldOnly?: boolean;
  actorStaffUserId?: string;
  effectiveAfter?: Date;
  effectiveBefore?: Date;
  limit: number;
  cursor: EditorListCursor | null;
};

export type LegalDashboardActiveHold = {
  contentItemId: string;
  slug: string;
  title: string;
  legalHoldAt: Date;
  legalHoldReason: string;
  publicationStatus: PublicationStatus;
  actorDisplayName: string | null;
};

export type LegalDashboardEntry = {
  actionId: string;
  contentItemId: string;
  slug: string;
  articleTitle: string;
  actionType: ContentLegalActionType;
  polarity: ContentLegalActionPolarity;
  reasonCategory: ContentLegalReasonCategory;
  effectiveAt: Date;
  createdAt: Date;
  actor: {
    id: string;
    displayName: string;
  };
  currentState: {
    publicationStatus: PublicationStatus;
    legalHoldAt: Date | null;
    retractedAt: Date | null;
    takedownAt: Date | null;
  };
};

export type LegalDashboardResult = {
  activeHolds: LegalDashboardActiveHold[];
  entries: LegalDashboardEntry[];
  nextCursor: string | null;
};

export type ContentLegalWorkspaceAction = {
  id: string;
  actionType: ContentLegalActionType;
  polarity: ContentLegalActionPolarity;
  reasonCategory: ContentLegalReasonCategory;
  internalNote: string;
  publicNote: string | null;
  effectiveAt: Date;
  createdAt: Date;
  actor: {
    id: string;
    displayName: string;
  };
};

export type ContentLegalWorkspace = {
  contentItem: {
    id: string;
    slug: string;
    title: string;
    publicationStatus: PublicationStatus;
    publishedVersionId: string | null;
    legalHoldAt: Date | null;
    legalHoldReason: string | null;
    retractedAt: Date | null;
    takedownAt: Date | null;
    updatedAt: Date;
  };
  actions: ContentLegalWorkspaceAction[];
};

const LEGAL_DASHBOARD_DEFAULT_LIMIT = 25;
const LEGAL_DASHBOARD_MAX_LIMIT = 50;
const LEGAL_ACTIVE_HOLD_LIMIT = 50;

export function clampLegalDashboardLimit(limit: number | undefined): number {
  if (!Number.isInteger(limit) || (limit ?? 0) <= 0) {
    return LEGAL_DASHBOARD_DEFAULT_LIMIT;
  }
  return Math.min(limit ?? LEGAL_DASHBOARD_DEFAULT_LIMIT, LEGAL_DASHBOARD_MAX_LIMIT);
}

export async function listLegalDashboard(
  filters: LegalDashboardFilters,
): Promise<LegalDashboardResult> {
  const db = getDb();
  const limit = clampLegalDashboardLimit(filters.limit);
  const pageLimit = limit + 1;

  const activeHolds = await db
    .select({
      contentItemId: contentItems.id,
      slug: contentItems.slug,
      title: publishedVersion.title,
      legalHoldAt: contentItems.legalHoldAt,
      legalHoldReason: contentItems.legalHoldReason,
      publicationStatus: contentItems.publicationStatus,
      actorDisplayName: staffUsers.displayName,
    })
    .from(contentItems)
    .leftJoin(
      publishedVersion,
      eq(contentItems.publishedVersionId, publishedVersion.id),
    )
    .leftJoin(
      contentLegalActions,
      eq(contentItems.legalHoldActionId, contentLegalActions.id),
    )
    .leftJoin(staffUsers, eq(staffUsers.id, contentLegalActions.actorStaffUserId))
    .where(
      and(isNull(contentItems.deletedAt), isNotNull(contentItems.legalHoldAt)),
    )
    .orderBy(desc(contentItems.legalHoldAt))
    .limit(LEGAL_ACTIVE_HOLD_LIMIT);

  const actionConditions: SQL[] = [isNull(contentItems.deletedAt)];

  if (filters.actionType) {
    actionConditions.push(eq(contentLegalActions.actionType, filters.actionType));
  }

  if (filters.activeHoldOnly) {
    actionConditions.push(isNotNull(contentItems.legalHoldAt));
  }

  if (filters.actorStaffUserId) {
    actionConditions.push(
      eq(contentLegalActions.actorStaffUserId, filters.actorStaffUserId),
    );
  }

  if (filters.effectiveAfter) {
    actionConditions.push(gte(contentLegalActions.effectiveAt, filters.effectiveAfter));
  }

  if (filters.effectiveBefore) {
    actionConditions.push(lte(contentLegalActions.effectiveAt, filters.effectiveBefore));
  }

  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search.replace(/[%_\\]/g, "\\$&")}%`;
    actionConditions.push(
      or(
        ilike(contentItems.slug, pattern),
        ilike(publishedVersion.title, pattern),
      )!,
    );
  }

  const cursorDate = filters.cursor ? new Date(filters.cursor.updatedAt) : null;
  if (cursorDate) {
    actionConditions.push(
      or(
        lt(contentLegalActions.createdAt, cursorDate),
        and(
          eq(contentLegalActions.createdAt, cursorDate),
          lt(contentLegalActions.id, filters.cursor!.id),
        ),
      )!,
    );
  }

  const rows = await db
    .select({
      actionId: contentLegalActions.id,
      contentItemId: contentLegalActions.contentItemId,
      slug: contentItems.slug,
      articleTitle: publishedVersion.title,
      actionType: contentLegalActions.actionType,
      polarity: contentLegalActions.polarity,
      reasonCategory: contentLegalActions.reasonCategory,
      effectiveAt: contentLegalActions.effectiveAt,
      createdAt: contentLegalActions.createdAt,
      actorId: staffUsers.id,
      actorDisplayName: staffUsers.displayName,
      publicationStatus: contentItems.publicationStatus,
      legalHoldAt: contentItems.legalHoldAt,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
    })
    .from(contentLegalActions)
    .innerJoin(contentItems, eq(contentItems.id, contentLegalActions.contentItemId))
    .leftJoin(
      publishedVersion,
      eq(contentItems.publishedVersionId, publishedVersion.id),
    )
    .innerJoin(staffUsers, eq(staffUsers.id, contentLegalActions.actorStaffUserId))
    .where(and(...actionConditions))
    .orderBy(desc(contentLegalActions.createdAt), desc(contentLegalActions.id))
    .limit(pageLimit);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);

  return {
    activeHolds: activeHolds
      .filter((row) => row.legalHoldAt !== null && row.legalHoldReason !== null)
      .map((row) => ({
        contentItemId: row.contentItemId,
        slug: row.slug,
        title: row.title ?? row.slug,
        legalHoldAt: row.legalHoldAt!,
        legalHoldReason: row.legalHoldReason!,
        publicationStatus: row.publicationStatus,
        actorDisplayName: row.actorDisplayName,
      })),
    entries: page.map((row) => ({
      actionId: row.actionId,
      contentItemId: row.contentItemId,
      slug: row.slug,
      articleTitle: row.articleTitle ?? row.slug,
      actionType: row.actionType,
      polarity: row.polarity,
      reasonCategory: row.reasonCategory,
      effectiveAt: row.effectiveAt,
      createdAt: row.createdAt,
      actor: {
        id: row.actorId,
        displayName: row.actorDisplayName,
      },
      currentState: {
        publicationStatus: row.publicationStatus,
        legalHoldAt: row.legalHoldAt,
        retractedAt: row.retractedAt,
        takedownAt: row.takedownAt,
      },
    })),
    nextCursor:
      hasMore && last
        ? encodeEditorListCursor({
            updatedAt: last.createdAt.toISOString(),
            id: last.actionId,
          })
        : null,
  };
}

export async function getContentLegalWorkspace(
  contentItemId: string,
): Promise<ContentLegalWorkspace | null> {
  const db = getDb();
  const [item] = await db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      legalHoldAt: contentItems.legalHoldAt,
      legalHoldReason: contentItems.legalHoldReason,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
      updatedAt: contentItems.updatedAt,
      deletedAt: contentItems.deletedAt,
      title: publishedVersion.title,
    })
    .from(contentItems)
    .leftJoin(
      publishedVersion,
      eq(contentItems.publishedVersionId, publishedVersion.id),
    )
    .where(eq(contentItems.id, contentItemId))
    .limit(1);

  if (!item || item.deletedAt !== null) {
    return null;
  }

  const actionRows = await db
    .select({
      id: contentLegalActions.id,
      actionType: contentLegalActions.actionType,
      polarity: contentLegalActions.polarity,
      reasonCategory: contentLegalActions.reasonCategory,
      internalNote: contentLegalActions.internalNote,
      publicNote: contentLegalActions.publicNote,
      effectiveAt: contentLegalActions.effectiveAt,
      createdAt: contentLegalActions.createdAt,
      actorId: staffUsers.id,
      actorDisplayName: staffUsers.displayName,
    })
    .from(contentLegalActions)
    .innerJoin(staffUsers, eq(staffUsers.id, contentLegalActions.actorStaffUserId))
    .where(eq(contentLegalActions.contentItemId, contentItemId))
    .orderBy(contentLegalActions.createdAt, contentLegalActions.id);

  let title = item.title ?? item.slug;
  if (!item.title && item.publishedVersionId === null) {
    const [draft] = await db
      .select({ title: contentVersions.title })
      .from(contentVersions)
      .where(eq(contentVersions.contentItemId, contentItemId))
      .orderBy(desc(contentVersions.versionNumber))
      .limit(1);
    title = draft?.title ?? item.slug;
  }

  return {
    contentItem: {
      id: item.id,
      slug: item.slug,
      title,
      publicationStatus: item.publicationStatus,
      publishedVersionId: item.publishedVersionId,
      legalHoldAt: item.legalHoldAt,
      legalHoldReason: item.legalHoldReason,
      retractedAt: item.retractedAt,
      takedownAt: item.takedownAt,
      updatedAt: item.updatedAt,
    },
    actions: actionRows.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      polarity: row.polarity,
      reasonCategory: row.reasonCategory,
      internalNote: row.internalNote,
      publicNote: row.publicNote,
      effectiveAt: row.effectiveAt,
      createdAt: row.createdAt,
      actor: {
        id: row.actorId,
        displayName: row.actorDisplayName,
      },
    })),
  };
}

export async function listLegalDashboardActors(): Promise<
  Array<{ id: string; displayName: string }>
> {
  const db = getDb();
  const rows = await db
    .selectDistinct({
      id: staffUsers.id,
      displayName: staffUsers.displayName,
    })
    .from(contentLegalActions)
    .innerJoin(staffUsers, eq(staffUsers.id, contentLegalActions.actorStaffUserId))
    .orderBy(staffUsers.displayName);

  return rows;
}
