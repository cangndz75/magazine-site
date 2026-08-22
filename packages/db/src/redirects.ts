import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import {
  CONTENT_KIND,
  ENTITY_STATUS,
  PUBLICATION_STATUS,
  REDIRECT_ERROR,
  REDIRECT_RESOLUTION,
  RedirectError,
  authorizeRedirectManage,
  decideRedirectCreate,
  decideRedirectGraph,
  decideRedirectUpdate,
  normalizeRedirectPath,
  resolveManualRedirect,
  type RedirectResolution,
  type RedirectRuleRecord,
  type StaffRole,
} from "@magazine/domain";
import { getDb } from "./client";
import { contentItems } from "./schema/content";
import { entities } from "./schema/entities";
import { redirectRuleAuditEvents, redirectRules } from "./schema/redirects";
import { staffUsers } from "./schema/staff";

export type RedirectActor = {
  staffUserId: string;
  roles: readonly StaffRole[];
};

export type RedirectRuleProjection = {
  id: string;
  sourcePath: string;
  targetPath: string;
  status: "PERMANENT";
  enabled: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByDisplayName: string | null;
};

export type RedirectAuditProjection = {
  occurredAt: string;
  actorDisplayName: string;
  sourcePath: string;
  oldTargetPath: string | null;
  newTargetPath: string | null;
  oldEnabled: boolean | null;
  newEnabled: boolean;
};

export type RedirectRuleListResult = {
  items: RedirectRuleProjection[];
  nextCursor: string | null;
};

export type RedirectRuleListInput = {
  actor: RedirectActor;
  search?: string | null;
  enabled?: boolean | null;
  cursor?: string | null;
  limit?: number;
};

export type CreateRedirectRuleInput = {
  actor: RedirectActor;
  sourcePath: string;
  targetPath: string;
  enabled?: boolean;
  note?: string | null;
  now?: Date;
};

export type UpdateRedirectRuleInput = {
  actor: RedirectActor;
  id: string;
  sourcePath?: string;
  targetPath?: string;
  enabled?: boolean;
  note?: string | null;
  expectedUpdatedAt: Date | string;
  now?: Date;
};

type RedirectRuleRow = typeof redirectRules.$inferSelect;
type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

const LIST_DEFAULT_LIMIT = 25;
const LIST_MAX_LIMIT = 100;

export async function resolvePublicRedirect(
  rawPath: string,
): Promise<RedirectResolution> {
  const path = normalizeRedirectPath(rawPath, "source");
  if (!path.ok) {
    return { kind: REDIRECT_RESOLUTION.NONE };
  }
  const [rule] = await getDb()
    .select({
      targetPath: redirectRules.targetPath,
      status: redirectRules.status,
      enabled: redirectRules.enabled,
    })
    .from(redirectRules)
    .where(and(eq(redirectRules.sourcePath, path.value), eq(redirectRules.enabled, true)))
    .limit(1);
  return resolveManualRedirect(
    rule
      ? {
          targetPath: rule.targetPath,
          status: rule.status as "PERMANENT",
          enabled: rule.enabled,
        }
      : null,
  );
}

export async function listRedirectRules(
  input: RedirectRuleListInput,
): Promise<RedirectRuleListResult> {
  authorizeActor(input.actor);
  const limit = clampListLimit(input.limit);
  const cursor = decodeCursor(input.cursor);
  const clauses = [];
  if (input.enabled !== null && input.enabled !== undefined) {
    clauses.push(eq(redirectRules.enabled, input.enabled));
  }
  const search = input.search?.trim();
  if (search) {
    const pattern = `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    clauses.push(
      or(
        ilike(redirectRules.sourcePath, pattern),
        ilike(redirectRules.targetPath, pattern),
      ),
    );
  }
  if (cursor) {
    clauses.push(
      or(
        lt(redirectRules.updatedAt, cursor.updatedAt),
        and(
          eq(redirectRules.updatedAt, cursor.updatedAt),
          lt(redirectRules.id, cursor.id),
        ),
      ),
    );
  }

  const rows = await getDb()
    .select({
      id: redirectRules.id,
      sourcePath: redirectRules.sourcePath,
      targetPath: redirectRules.targetPath,
      status: redirectRules.status,
      enabled: redirectRules.enabled,
      note: redirectRules.note,
      createdAt: redirectRules.createdAt,
      updatedAt: redirectRules.updatedAt,
      updatedByDisplayName: staffUsers.displayName,
    })
    .from(redirectRules)
    .leftJoin(staffUsers, eq(staffUsers.id, redirectRules.updatedByStaffUserId))
    .where(clauses.length > 0 ? and(...clauses) : undefined)
    .orderBy(desc(redirectRules.updatedAt), desc(redirectRules.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit).map(projectRule);
  const last = rows.length > limit ? rows[limit - 1] : null;
  return {
    items,
    nextCursor: last ? encodeCursor(last.updatedAt, last.id) : null,
  };
}

export async function createRedirectRule(
  input: CreateRedirectRuleInput,
): Promise<RedirectRuleProjection> {
  authorizeActor(input.actor);
  const now = input.now ?? new Date();
  const plan = decideRedirectCreate({
    sourcePath: input.sourcePath,
    targetPath: input.targetPath,
    enabled: input.enabled,
    note: input.note,
    now,
  });

  return getDb().transaction(async (tx) => {
    await assertSourceAvailable(tx, plan.sourcePath);
    await assertTargetSafe(tx, plan.targetPath);
    await assertGraphSafe(tx, {
      sourcePath: plan.sourcePath,
      targetPath: plan.targetPath,
      enabled: plan.enabled,
    });

    const [inserted] = await tx
      .insert(redirectRules)
      .values({
        sourcePath: plan.sourcePath,
        targetPath: plan.targetPath,
        status: plan.status,
        enabled: plan.enabled,
        note: plan.note,
        createdAt: now,
        updatedAt: plan.updatedAt,
        createdByStaffUserId: input.actor.staffUserId,
        updatedByStaffUserId: input.actor.staffUserId,
      })
      .returning();
    if (!inserted) {
      throw new RedirectError(REDIRECT_ERROR.SOURCE_CONFLICT);
    }
    await appendAudit(tx, inserted, input.actor.staffUserId, plan.changeSet);
    return projectRule(inserted);
  }).catch((error) => {
    if (isUniqueViolation(error)) {
      throw new RedirectError(REDIRECT_ERROR.SOURCE_CONFLICT);
    }
    throw error;
  });
}

export async function updateRedirectRule(
  input: UpdateRedirectRuleInput,
): Promise<RedirectRuleProjection> {
  authorizeActor(input.actor);
  const now = input.now ?? new Date();
  return getDb().transaction(async (tx) => {
    const current = await lockRedirectRule(tx, input.id);
    const plan = decideRedirectUpdate({
      current,
      sourcePath: input.sourcePath,
      targetPath: input.targetPath,
      enabled: input.enabled,
      note: input.note,
      expectedUpdatedAt: input.expectedUpdatedAt,
      now,
    });

    if (current.sourcePath !== plan.sourcePath) {
      await assertSourceAvailable(tx, plan.sourcePath);
    }
    await assertTargetSafe(tx, plan.targetPath);
    await assertGraphSafe(tx, {
      id: current.id,
      sourcePath: plan.sourcePath,
      targetPath: plan.targetPath,
      enabled: plan.enabled,
    });

    const [updated] = await tx
      .update(redirectRules)
      .set({
        sourcePath: plan.sourcePath,
        targetPath: plan.targetPath,
        enabled: plan.enabled,
        note: plan.note,
        updatedAt: plan.updatedAt,
        updatedByStaffUserId: input.actor.staffUserId,
      })
      .where(eq(redirectRules.id, input.id))
      .returning();
    if (!updated) {
      throw new RedirectError(REDIRECT_ERROR.WRITE_CONFLICT);
    }
    await appendAudit(tx, updated, input.actor.staffUserId, plan.changeSet, current);
    return projectRule(updated);
  }).catch((error) => {
    if (isUniqueViolation(error)) {
      throw new RedirectError(REDIRECT_ERROR.SOURCE_CONFLICT);
    }
    throw error;
  });
}

export async function getRedirectRule(input: {
  actor: RedirectActor;
  id: string;
}): Promise<RedirectRuleProjection> {
  authorizeActor(input.actor);
  const [row] = await getDb()
    .select({
      id: redirectRules.id,
      sourcePath: redirectRules.sourcePath,
      targetPath: redirectRules.targetPath,
      status: redirectRules.status,
      enabled: redirectRules.enabled,
      note: redirectRules.note,
      createdAt: redirectRules.createdAt,
      updatedAt: redirectRules.updatedAt,
      updatedByDisplayName: staffUsers.displayName,
    })
    .from(redirectRules)
    .leftJoin(staffUsers, eq(staffUsers.id, redirectRules.updatedByStaffUserId))
    .where(eq(redirectRules.id, input.id))
    .limit(1);
  if (!row) {
    throw new RedirectError(REDIRECT_ERROR.NOT_FOUND);
  }
  return projectRule(row);
}

export async function listRedirectRuleAuditEvents(input: {
  actor: RedirectActor;
  redirectRuleId: string;
  limit?: number;
}): Promise<RedirectAuditProjection[]> {
  authorizeActor(input.actor);
  const [rule] = await getDb()
    .select({ id: redirectRules.id })
    .from(redirectRules)
    .where(eq(redirectRules.id, input.redirectRuleId))
    .limit(1);
  if (!rule) {
    throw new RedirectError(REDIRECT_ERROR.NOT_FOUND);
  }
  const limit = Math.max(1, Math.min(25, Math.floor(input.limit ?? 10)));
  const rows = await getDb()
    .select({
      occurredAt: redirectRuleAuditEvents.occurredAt,
      actorDisplayName: staffUsers.displayName,
      sourcePath: redirectRuleAuditEvents.sourcePath,
      oldTargetPath: redirectRuleAuditEvents.oldTargetPath,
      newTargetPath: redirectRuleAuditEvents.newTargetPath,
      oldEnabled: redirectRuleAuditEvents.oldEnabled,
      newEnabled: redirectRuleAuditEvents.newEnabled,
    })
    .from(redirectRuleAuditEvents)
    .innerJoin(staffUsers, eq(staffUsers.id, redirectRuleAuditEvents.actorStaffUserId))
    .where(eq(redirectRuleAuditEvents.redirectRuleId, input.redirectRuleId))
    .orderBy(desc(redirectRuleAuditEvents.occurredAt))
    .limit(limit);
  return rows.map((row) => ({
    occurredAt: iso(row.occurredAt),
    actorDisplayName: row.actorDisplayName,
    sourcePath: row.sourcePath,
    oldTargetPath: row.oldTargetPath,
    newTargetPath: row.newTargetPath,
    oldEnabled: row.oldEnabled,
    newEnabled: row.newEnabled ?? false,
  }));
}

async function lockRedirectRule(tx: Tx, id: string): Promise<RedirectRuleRecord> {
  const [row] = await tx
    .select({
      id: redirectRules.id,
      sourcePath: redirectRules.sourcePath,
      targetPath: redirectRules.targetPath,
      status: redirectRules.status,
      enabled: redirectRules.enabled,
      note: redirectRules.note,
      createdAt: redirectRules.createdAt,
      updatedAt: redirectRules.updatedAt,
    })
    .from(redirectRules)
    .where(eq(redirectRules.id, id))
    .for("update");
  if (!row) {
    throw new RedirectError(REDIRECT_ERROR.NOT_FOUND);
  }
  return row as RedirectRuleRecord;
}

async function assertSourceAvailable(tx: Tx, sourcePath: string): Promise<void> {
  const managed = parseManagedPath(sourcePath);
  if (!managed) {
    return;
  }
  if (await managedPathIsPublic(tx, managed)) {
    throw new RedirectError(REDIRECT_ERROR.SOURCE_CONFLICT);
  }
}

async function assertTargetSafe(tx: Tx, targetPath: string): Promise<void> {
  const managed = parseManagedPath(targetPath);
  if (!managed) {
    return;
  }
  if (!(await managedPathIsPublic(tx, managed))) {
    throw new RedirectError(REDIRECT_ERROR.TARGET_INVALID);
  }
}

async function assertGraphSafe(
  tx: Tx,
  candidate: { id?: string; sourcePath: string; targetPath: string; enabled: boolean },
): Promise<void> {
  const rows = await tx
    .select({
      id: redirectRules.id,
      sourcePath: redirectRules.sourcePath,
      targetPath: redirectRules.targetPath,
      enabled: redirectRules.enabled,
    })
    .from(redirectRules)
    .where(eq(redirectRules.enabled, true));
  const decision = decideRedirectGraph({ candidate, existingRules: rows });
  if (!decision.ok) {
    throw new RedirectError(decision.code);
  }
}

async function appendAudit(
  tx: Tx,
  rule: RedirectRuleRow,
  actorStaffUserId: string,
  changeSet: Record<string, unknown>,
  previous?: RedirectRuleRecord,
): Promise<void> {
  await tx.insert(redirectRuleAuditEvents).values({
    redirectRuleId: rule.id,
    actorStaffUserId,
    occurredAt: rule.updatedAt,
    sourcePath: rule.sourcePath,
    oldTargetPath: previous?.targetPath ?? null,
    newTargetPath: rule.targetPath,
    oldEnabled: previous?.enabled ?? null,
    newEnabled: rule.enabled,
    changeSet,
  });
}

type ManagedPath =
  | { kind: "article"; slug: string }
  | { kind: "gallery"; slug: string }
  | { kind: "entity"; slug: string };

function parseManagedPath(path: string): ManagedPath | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 1) {
    return { kind: "article", slug: parts[0] as string };
  }
  if (parts.length === 2 && parts[0] === "galeri") {
    return { kind: "gallery", slug: parts[1] as string };
  }
  if (parts.length === 2 && parts[0] === "kimdir") {
    return { kind: "entity", slug: parts[1] as string };
  }
  return null;
}

async function managedPathIsPublic(tx: Tx, path: ManagedPath): Promise<boolean> {
  if (path.kind === "entity") {
    const [row] = await tx
      .select({ id: entities.id })
      .from(entities)
      .where(
        and(
          eq(entities.slug, path.slug),
          eq(entities.status, ENTITY_STATUS.ACTIVE),
          sql`${entities.deletedAt} IS NULL`,
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  const contentKind =
    path.kind === "gallery" ? CONTENT_KIND.GALLERY : CONTENT_KIND.ARTICLE;
  const [row] = await tx
    .select({ id: contentItems.id })
    .from(contentItems)
    .where(
      and(
        eq(contentItems.slug, path.slug),
        eq(contentItems.contentKind, contentKind),
        eq(contentItems.publicationStatus, PUBLICATION_STATUS.PUBLISHED),
        sql`${contentItems.publishedVersionId} IS NOT NULL`,
        sql`${contentItems.publishedAt} IS NOT NULL`,
        sql`${contentItems.deletedAt} IS NULL`,
        sql`${contentItems.retractedAt} IS NULL`,
        sql`${contentItems.takedownAt} IS NULL`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

function projectRule(row: {
  id: string;
  sourcePath: string;
  targetPath: string;
  status: string;
  enabled: boolean;
  note: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  updatedByDisplayName?: string | null;
}): RedirectRuleProjection {
  return {
    id: row.id,
    sourcePath: row.sourcePath,
    targetPath: row.targetPath,
    status: "PERMANENT",
    enabled: row.enabled,
    note: row.note,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    updatedByDisplayName: row.updatedByDisplayName ?? null,
  };
}

function clampListLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) {
    return LIST_DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(LIST_MAX_LIMIT, Math.floor(limit as number)));
}

function encodeCursor(updatedAt: Date | string, id: string): string {
  return Buffer.from(JSON.stringify({ updatedAt: iso(updatedAt), id })).toString("base64url");
}

function decodeCursor(
  value: string | null | undefined,
): { updatedAt: Date; id: string } | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      updatedAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string") {
      return null;
    }
    const updatedAt = new Date(parsed.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) {
      return null;
    }
    return { updatedAt, id: parsed.id };
  } catch {
    return null;
  }
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function authorizeActor(actor: RedirectActor): void {
  const authorized = authorizeRedirectManage({ roles: actor.roles });
  if (!authorized.ok) {
    throw new RedirectError(REDIRECT_ERROR.FORBIDDEN);
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  if ("code" in error && (error as { code?: unknown }).code === "23505") {
    return true;
  }
  if ("cause" in error) {
    return isUniqueViolation((error as { cause?: unknown }).cause);
  }
  return false;
}
