import { and, desc, eq, lt, or } from "drizzle-orm";
import {
  assertContentAuditChangeSet,
  canAccessEditorContentByPrimaryCategory,
  encodeEditorAuditCursor,
  type ContentAuditActorKind,
  type ContentAuditEventType,
  type EditorAuditCursor,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentAuditEvents } from "../schema/audit-events";
import { staffUsers } from "../schema/staff";
import { getEditorContentAccess } from "./access";

export type EditorContentAuditEvent = {
  id: string;
  contentItemId: string;
  versionId: string | null;
  eventType: ContentAuditEventType;
  actor: {
    kind: ContentAuditActorKind;
    staffUserId: string | null;
    displayName: string | null;
  };
  occurredAt: Date;
  changeSet: ReturnType<typeof assertContentAuditChangeSet>;
};

export type ListContentAuditEventsResult = {
  items: EditorContentAuditEvent[];
  nextCursor: string | null;
};

export async function listContentAuditEvents(
  contentItemId: string,
  scope: EditorStaffScope,
  input: {
    limit: number;
    cursor: EditorAuditCursor | null;
  },
): Promise<ListContentAuditEventsResult | null> {
  const access = await getEditorContentAccess(contentItemId);
  if (
    !access ||
    !canAccessEditorContentByPrimaryCategory({
      ...scope,
      primaryCategoryId: access.displayPrimaryCategoryId,
    })
  ) {
    return null;
  }

  const db = getDb();
  const pageLimit = input.limit + 1;
  const cursorDate = input.cursor ? new Date(input.cursor.occurredAt) : null;

  const rows = await db
    .select({
      id: contentAuditEvents.id,
      contentItemId: contentAuditEvents.contentItemId,
      versionId: contentAuditEvents.contentVersionId,
      eventType: contentAuditEvents.eventType,
      actorKind: contentAuditEvents.actorKind,
      actorStaffUserId: contentAuditEvents.actorStaffUserId,
      actorDisplayName: staffUsers.displayName,
      occurredAt: contentAuditEvents.occurredAt,
      changeSet: contentAuditEvents.changeSet,
    })
    .from(contentAuditEvents)
    .leftJoin(staffUsers, eq(staffUsers.id, contentAuditEvents.actorStaffUserId))
    .where(
      and(
        eq(contentAuditEvents.contentItemId, contentItemId),
        cursorDate
          ? or(
              lt(contentAuditEvents.occurredAt, cursorDate),
              and(
                eq(contentAuditEvents.occurredAt, cursorDate),
                lt(contentAuditEvents.id, input.cursor!.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(contentAuditEvents.occurredAt), desc(contentAuditEvents.id))
    .limit(pageLimit);

  const items = rows.slice(0, input.limit).map((row) => ({
    id: row.id,
    contentItemId: row.contentItemId,
    versionId: row.versionId,
    eventType: row.eventType,
    actor: {
      kind: row.actorKind,
      staffUserId: row.actorStaffUserId,
      displayName: row.actorDisplayName,
    },
    occurredAt: row.occurredAt,
    changeSet: assertContentAuditChangeSet(row.changeSet),
  }));

  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > input.limit && last
        ? encodeEditorAuditCursor({ occurredAt: last.occurredAt, id: last.id })
        : null,
  };
}
