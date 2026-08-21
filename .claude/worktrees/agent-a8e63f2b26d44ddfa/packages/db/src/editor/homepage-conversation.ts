import { asc, eq, sql } from "drizzle-orm";
import {
  ConversationError,
  CONVERSATION_ERROR,
  type ConversationDecision,
  assertConversationExpectedUpdatedAt,
  assertConversationReorderPermutation,
  authorizeHomepageConversationWrite,
  canonicalizeConversationLabel,
  canonicalizeConversationReason,
  canonicalizeOptionalContentItemId,
  nextMonotonicUpdatedAt,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems } from "../schema/content";
import { homepageConversationItems } from "../schema/homepage-conversation";
import type { PublishingTx } from "../publishing/db-types";

const SORT_ORDER_RENUMBER_OFFSET = 1_000_000;

export type EditorHomepageConversationItem = {
  id: string;
  sortOrder: number;
  label: string;
  reason: string | null;
  contentItemId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateHomepageConversationItemInput = {
  scope: EditorStaffScope;
  label: string;
  reason?: string | null;
  contentItemId?: string | null;
  isActive?: boolean;
};

export type UpdateHomepageConversationItemInput = {
  scope: EditorStaffScope;
  id: string;
  expectedUpdatedAt: Date;
  label?: string;
  reason?: string | null;
  contentItemId?: string | null;
  isActive?: boolean;
};

function unwrapConversationDecision<T>(decision: ConversationDecision<T>): T {
  if (!decision.ok) {
    throw new ConversationError(decision.code);
  }
  return decision.value;
}

function authorize(scope: EditorStaffScope): void {
  unwrapConversationDecision(authorizeHomepageConversationWrite(scope));
}

function toEditorItem(
  row: typeof homepageConversationItems.$inferSelect,
): EditorHomepageConversationItem {
  return {
    id: row.id,
    sortOrder: row.sortOrder,
    label: row.label,
    reason: row.reason,
    contentItemId: row.contentItemId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function lockConversationTable(tx: PublishingTx): Promise<void> {
  await tx.execute(
    sql`LOCK TABLE homepage_conversation_items IN SHARE ROW EXCLUSIVE MODE`,
  );
}

async function loadLockedRows(tx: PublishingTx) {
  return tx
    .select()
    .from(homepageConversationItems)
    .orderBy(asc(homepageConversationItems.sortOrder), asc(homepageConversationItems.id));
}

async function assertLinkedContentExists(
  tx: PublishingTx,
  contentItemId: string | null,
): Promise<void> {
  if (contentItemId === null) {
    return;
  }

  const [item] = await tx
    .select({
      id: contentItems.id,
      deletedAt: contentItems.deletedAt,
    })
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId))
    .limit(1);

  if (!item || item.deletedAt !== null) {
    throw new ConversationError(CONVERSATION_ERROR.INVALID_CONTENT_ITEM);
  }
}

async function renumberSortOrders(
  tx: PublishingTx,
  orderedIds: readonly string[],
  now: Date,
): Promise<void> {
  if (orderedIds.length === 0) {
    return;
  }

  await tx
    .update(homepageConversationItems)
    .set({
      sortOrder: sql`${homepageConversationItems.sortOrder} + ${SORT_ORDER_RENUMBER_OFFSET}`,
    });

  const currentRows = await tx.select().from(homepageConversationItems);
  const byId = new Map(currentRows.map((row) => [row.id, row]));

  for (const [index, id] of orderedIds.entries()) {
    const current = byId.get(id);
    if (!current) {
      throw new ConversationError(CONVERSATION_ERROR.INVALID_REORDER);
    }
    await tx
      .update(homepageConversationItems)
      .set({
        sortOrder: index + 1,
        updatedAt: nextMonotonicUpdatedAt(current.updatedAt, now),
      })
      .where(eq(homepageConversationItems.id, id));
  }
}

export async function listHomepageConversationItems(
  scope: EditorStaffScope,
): Promise<EditorHomepageConversationItem[]> {
  authorize(scope);
  const db = getDb();
  const rows = await db
    .select()
    .from(homepageConversationItems)
    .orderBy(asc(homepageConversationItems.sortOrder), asc(homepageConversationItems.id));
  return rows.map(toEditorItem);
}

export async function createHomepageConversationItem(
  input: CreateHomepageConversationItemInput,
): Promise<EditorHomepageConversationItem> {
  authorize(input.scope);
  const label = unwrapConversationDecision(
    canonicalizeConversationLabel(input.label),
  );
  const reason = unwrapConversationDecision(
    canonicalizeConversationReason(input.reason),
  );
  const contentItemId = unwrapConversationDecision(
    canonicalizeOptionalContentItemId(input.contentItemId),
  );
  const isActive = input.isActive ?? true;

  const db = getDb();
  return db.transaction(async (tx) => {
    await lockConversationTable(tx);
    await assertLinkedContentExists(tx, contentItemId);
    const rows = await loadLockedRows(tx);
    const sortOrder = (rows[rows.length - 1]?.sortOrder ?? 0) + 1;
    const [created] = await tx
      .insert(homepageConversationItems)
      .values({
        sortOrder,
        label,
        reason,
        contentItemId,
        isActive,
      })
      .returning();

    if (!created) {
      throw new ConversationError(CONVERSATION_ERROR.ITEM_NOT_FOUND);
    }

    return toEditorItem(created);
  });
}

export async function updateHomepageConversationItem(
  input: UpdateHomepageConversationItemInput,
): Promise<EditorHomepageConversationItem> {
  authorize(input.scope);
  const db = getDb();

  return db.transaction(async (tx) => {
    await lockConversationTable(tx);
    const [current] = await tx
      .select()
      .from(homepageConversationItems)
      .where(eq(homepageConversationItems.id, input.id))
      .limit(1);

    if (!current) {
      throw new ConversationError(CONVERSATION_ERROR.ITEM_NOT_FOUND);
    }

    unwrapConversationDecision(
      assertConversationExpectedUpdatedAt({
        currentUpdatedAt: current.updatedAt,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    );

    const label =
      input.label === undefined
        ? current.label
        : unwrapConversationDecision(canonicalizeConversationLabel(input.label));
    const reason =
      input.reason === undefined
        ? current.reason
        : unwrapConversationDecision(canonicalizeConversationReason(input.reason));
    const contentItemId =
      input.contentItemId === undefined
        ? current.contentItemId
        : unwrapConversationDecision(
            canonicalizeOptionalContentItemId(input.contentItemId),
          );
    const isActive = input.isActive ?? current.isActive;

    await assertLinkedContentExists(tx, contentItemId);

    const [updated] = await tx
      .update(homepageConversationItems)
      .set({
        label,
        reason,
        contentItemId,
        isActive,
        updatedAt: nextMonotonicUpdatedAt(current.updatedAt),
      })
      .where(eq(homepageConversationItems.id, current.id))
      .returning();

    if (!updated) {
      throw new ConversationError(CONVERSATION_ERROR.ITEM_NOT_FOUND);
    }

    return toEditorItem(updated);
  });
}

export async function reorderHomepageConversationItems(input: {
  scope: EditorStaffScope;
  orderedIds: readonly string[];
}): Promise<EditorHomepageConversationItem[]> {
  authorize(input.scope);
  const db = getDb();

  return db.transaction(async (tx) => {
    await lockConversationTable(tx);
    const rows = await loadLockedRows(tx);
    const orderedIds = unwrapConversationDecision(
      assertConversationReorderPermutation({
        currentIds: rows.map((row) => row.id),
        orderedIds: input.orderedIds,
      }),
    );
    await renumberSortOrders(tx, orderedIds, new Date());
    const next = await loadLockedRows(tx);
    return next.map(toEditorItem);
  });
}

export async function deleteHomepageConversationItem(input: {
  scope: EditorStaffScope;
  id: string;
  expectedUpdatedAt: Date;
}): Promise<void> {
  authorize(input.scope);
  const db = getDb();

  await db.transaction(async (tx) => {
    await lockConversationTable(tx);
    const rows = await loadLockedRows(tx);
    const current = rows.find((row) => row.id === input.id);
    if (!current) {
      throw new ConversationError(CONVERSATION_ERROR.ITEM_NOT_FOUND);
    }

    unwrapConversationDecision(
      assertConversationExpectedUpdatedAt({
        currentUpdatedAt: current.updatedAt,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    );

    await tx
      .delete(homepageConversationItems)
      .where(eq(homepageConversationItems.id, current.id));

    const remainingIds = rows
      .filter((row) => row.id !== current.id)
      .map((row) => row.id);
    await renumberSortOrders(tx, remainingIds, new Date());
  });
}
