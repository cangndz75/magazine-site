import {
  and,
  desc,
  eq,
  exists,
  ilike,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  ENTITY_ERROR,
  ENTITY_STATUS,
  EntityError,
  authorizeEntityRead,
  authorizeEntitySelect,
  clampEditorListLimit,
  clampEditorLookupLimit,
  collectAdvisoryDuplicateSignals,
  decodeEditorListCursor,
  encodeEditorListCursor,
  normalizeEntitySearchKey,
  sanitizeEditorSearch,
  toEditorEntityProjection,
  type EditorEntityProjection,
  type EntityKind,
  type EntityStatus,
  type StaffRole,
} from "@magazine/domain";
import { getDb } from "../client";
import { entities, entityAliases, entityAuditEvents, entitySlugHistory } from "../schema/entities";
import type { PublishingTx } from "../publishing/db-types";
import { unwrapEntityDecision } from "./errors";

export type EditorEntityDetail = EditorEntityProjection;

export type EditorEntityListItem = {
  entityId: string;
  kind: EntityKind;
  status: EntityStatus;
  canonicalName: string;
  slug: string;
  summary: string | null;
  portraitMediaId: string | null;
  updatedAt: Date;
};

export type EditorEntityPickerItem = {
  id: string;
  canonicalName: string;
  kind: EntityKind;
  status: EntityStatus;
  portraitMediaId: string | null;
};

type EntityQueryDb = PublishingTx | ReturnType<typeof getDb>;

function toKind(value: string): EntityKind {
  return value as EntityKind;
}

function toStatus(value: string): EntityStatus {
  return value as EntityStatus;
}

export async function loadEditorEntityProjection(
  db: EntityQueryDb,
  entityId: string,
): Promise<EditorEntityDetail> {
  const [row] = await db
    .select()
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);
  if (!row) {
    throw new EntityError(ENTITY_ERROR.ENTITY_NOT_FOUND);
  }
  const aliases = await db
    .select({
      aliasId: entityAliases.id,
      display: entityAliases.alias,
      searchKey: entityAliases.normalizedAlias,
    })
    .from(entityAliases)
    .where(eq(entityAliases.entityId, row.id));

  return toEditorEntityProjection({
    entityId: row.id,
    kind: toKind(row.kind),
    status: toStatus(row.status),
    canonicalName: row.canonicalName,
    slug: row.slug,
    summary: row.description,
    biography: row.biography,
    portraitMediaId: row.portraitMediaId,
    birthDate: row.birthDate,
    occupation: row.occupation,
    officialWebsiteUrl: row.officialWebsiteUrl,
    aliases,
    mergedIntoEntityId: row.mergedIntoEntityId,
    deletedAt: row.deletedAt,
    updatedAt: row.updatedAt,
  });
}

export async function getEntityById(input: {
  actorRoles: readonly StaffRole[];
  entityId: string;
}): Promise<EditorEntityDetail> {
  unwrapEntityDecision(authorizeEntityRead({ roles: input.actorRoles }));
  const db = getDb();
  return loadEditorEntityProjection(db, input.entityId);
}

export async function listEntities(input: {
  actorRoles: readonly StaffRole[];
  q?: string;
  kind?: EntityKind;
  status?: EntityStatus;
  missingPortrait?: boolean;
  limit?: number;
  cursor?: string;
}): Promise<{ items: EditorEntityListItem[]; nextCursor: string | null }> {
  unwrapEntityDecision(authorizeEntityRead({ roles: input.actorRoles }));
  const db = getDb();
  const limit = clampEditorListLimit(input.limit);
  const conditions: SQL[] = [isNull(entities.deletedAt)];
  const search = sanitizeEditorSearch(input.q);
  if (search) {
    const like = `%${search}%`;
    const searchClause = or(
      ilike(entities.canonicalName, like),
      ilike(entities.slug, like),
      exists(
        db
          .select({ one: sql`1` })
          .from(entityAliases)
          .where(
            and(
              eq(entityAliases.entityId, entities.id),
              or(
                ilike(entityAliases.alias, like),
                ilike(entityAliases.normalizedAlias, like),
              ),
            ),
          ),
      ),
    );
    if (searchClause) {
      conditions.push(searchClause);
    }
  }
  if (input.kind) {
    conditions.push(eq(entities.kind, input.kind));
  }
  if (input.status) {
    conditions.push(eq(entities.status, input.status));
  }
  if (input.missingPortrait) {
    conditions.push(isNull(entities.portraitMediaId));
  }

  const cursor = decodeEditorListCursor(input.cursor);
  if (cursor) {
    conditions.push(
      sql`(${entities.updatedAt}, ${entities.id}) < (${cursor.updatedAt}::timestamptz, ${cursor.id}::uuid)`,
    );
  }

  const rows = await db
    .select({
      entityId: entities.id,
      kind: entities.kind,
      status: entities.status,
      canonicalName: entities.canonicalName,
      slug: entities.slug,
      summary: entities.description,
      portraitMediaId: entities.portraitMediaId,
      updatedAt: entities.updatedAt,
    })
    .from(entities)
    .where(and(...conditions))
    .orderBy(desc(entities.updatedAt), desc(entities.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map((row) => ({
      entityId: row.entityId,
      kind: toKind(row.kind),
      status: toStatus(row.status),
      canonicalName: row.canonicalName,
      slug: row.slug,
      summary: row.summary,
      portraitMediaId: row.portraitMediaId,
      updatedAt: row.updatedAt,
    })),
    nextCursor:
      rows.length > limit && last
        ? encodeEditorListCursor({ updatedAt: last.updatedAt, id: last.entityId })
        : null,
  };
}

export async function listEditorEntityPicker(input: {
  actorRoles: readonly StaffRole[];
  q?: string;
  limit?: number;
}): Promise<EditorEntityPickerItem[]> {
  unwrapEntityDecision(authorizeEntitySelect({ roles: input.actorRoles }));
  const db = getDb();
  const limit = clampEditorLookupLimit(input.limit);
  const conditions: SQL[] = [
    eq(entities.status, ENTITY_STATUS.ACTIVE),
    isNull(entities.deletedAt),
    isNull(entities.mergedIntoEntityId),
  ];
  const search = sanitizeEditorSearch(input.q);
  if (search) {
    const like = `%${search}%`;
    const searchClause = or(
      ilike(entities.canonicalName, like),
      ilike(entities.slug, like),
      exists(
        db
          .select({ one: sql`1` })
          .from(entityAliases)
          .where(
            and(
              eq(entityAliases.entityId, entities.id),
              or(
                ilike(entityAliases.alias, like),
                ilike(entityAliases.normalizedAlias, like),
              ),
            ),
          ),
      ),
    );
    if (searchClause) {
      conditions.push(searchClause);
    }
  }

  const rows = await db
    .select({
      id: entities.id,
      canonicalName: entities.canonicalName,
      kind: entities.kind,
      status: entities.status,
      portraitMediaId: entities.portraitMediaId,
    })
    .from(entities)
    .where(and(...conditions))
    .orderBy(entities.canonicalName)
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    canonicalName: row.canonicalName,
    kind: toKind(row.kind),
    status: toStatus(row.status),
    portraitMediaId: row.portraitMediaId,
  }));
}

export type EditorEntityDuplicateItem = {
  entityId: string;
  canonicalName: string;
  kind: EntityKind;
  status: EntityStatus;
  matchedOn: "CANONICAL_NAME" | "ALIAS";
};

export async function findPotentialEntityDuplicates(input: {
  actorRoles: readonly StaffRole[];
  canonicalName: string;
  aliases?: readonly string[];
  excludeEntityId?: string;
}): Promise<EditorEntityDuplicateItem[]> {
  unwrapEntityDecision(authorizeEntityRead({ roles: input.actorRoles }));
  const searchKey = normalizeEntitySearchKey(input.canonicalName);
  if (!searchKey) {
    return [];
  }

  const db = getDb();
  const like = `%${sanitizeEditorSearch(input.canonicalName) ?? searchKey}%`;
  const rows = await db
    .select({
      entityId: entities.id,
      canonicalName: entities.canonicalName,
      kind: entities.kind,
      status: entities.status,
      alias: entityAliases.alias,
    })
    .from(entities)
    .leftJoin(entityAliases, eq(entityAliases.entityId, entities.id))
    .where(
      and(
        isNull(entities.deletedAt),
        or(
          ilike(entities.canonicalName, like),
          ilike(entityAliases.alias, like),
          ilike(entityAliases.normalizedAlias, like),
        ),
      ),
    )
    .limit(40);

  const byId = new Map<
    string,
    {
      entityId: string;
      canonicalName: string;
      kind: EntityKind;
      status: EntityStatus;
      aliases: string[];
    }
  >();
  for (const row of rows) {
    if (input.excludeEntityId && row.entityId === input.excludeEntityId) {
      continue;
    }
    const current = byId.get(row.entityId) ?? {
      entityId: row.entityId,
      canonicalName: row.canonicalName,
      kind: toKind(row.kind),
      status: toStatus(row.status),
      aliases: [],
    };
    if (row.alias) {
      current.aliases.push(row.alias);
    }
    byId.set(row.entityId, current);
  }

  const signals = collectAdvisoryDuplicateSignals({
    candidateEntityId: input.excludeEntityId,
    canonicalName: input.canonicalName,
    aliases: input.aliases ?? [],
    existing: [...byId.values()],
  });

  return signals.flatMap((signal) => {
    const match = byId.get(signal.entityId);
    if (!match) {
      return [];
    }
    return [
      {
        entityId: match.entityId,
        canonicalName: match.canonicalName,
        kind: match.kind,
        status: match.status,
        matchedOn: signal.kind,
      },
    ];
  });
}

export type EditorEntitySlugHistoryItem = {
  oldSlug: string;
  changedAt: Date;
};

export type EditorEntityAuditItem = {
  eventType: string;
  occurredAt: Date;
  actorStaffUserId: string | null;
  changeSummary: string | null;
};

export async function listEntitySlugHistory(input: {
  actorRoles: readonly StaffRole[];
  entityId: string;
  limit?: number;
}): Promise<EditorEntitySlugHistoryItem[]> {
  unwrapEntityDecision(authorizeEntityRead({ roles: input.actorRoles }));
  const db = getDb();
  const boundedLimit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const rows = await db
    .select({
      oldSlug: entitySlugHistory.oldSlug,
      changedAt: entitySlugHistory.createdAt,
    })
    .from(entitySlugHistory)
    .where(eq(entitySlugHistory.entityId, input.entityId))
    .orderBy(desc(entitySlugHistory.createdAt))
    .limit(boundedLimit);
  return rows;
}

export async function listEntityAuditEvents(input: {
  actorRoles: readonly StaffRole[];
  entityId: string;
  limit?: number;
}): Promise<EditorEntityAuditItem[]> {
  unwrapEntityDecision(authorizeEntityRead({ roles: input.actorRoles }));
  const db = getDb();
  const boundedLimit = Math.min(Math.max(input.limit ?? 30, 1), 100);
  const rows = await db
    .select({
      eventType: entityAuditEvents.eventType,
      occurredAt: entityAuditEvents.occurredAt,
      actorStaffUserId: entityAuditEvents.actorStaffUserId,
      changeSet: entityAuditEvents.changeSet,
    })
    .from(entityAuditEvents)
    .where(eq(entityAuditEvents.entityId, input.entityId))
    .orderBy(desc(entityAuditEvents.occurredAt))
    .limit(boundedLimit);

  return rows.map((row) => ({
    eventType: row.eventType,
    occurredAt: row.occurredAt,
    actorStaffUserId: row.actorStaffUserId,
    changeSummary: summarizeAuditChangeSet(row.changeSet),
  }));
}

function summarizeAuditChangeSet(changeSet: unknown): string | null {
  if (!changeSet || typeof changeSet !== "object") {
    return null;
  }
  const record = changeSet as Record<string, { before?: unknown; after?: unknown }>;
  const parts: string[] = [];
  for (const [field, change] of Object.entries(record)) {
    if (change && typeof change === "object" && "before" in change && "after" in change) {
      parts.push(`${field}: ${String(change.before ?? "—")} → ${String(change.after ?? "—")}`);
    }
  }
  return parts.length > 0 ? parts.join("; ") : null;
}
