import { and, desc, eq, exists, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  CONTENT_AUDIT_ACTOR_KIND,
  STAFF_ADMIN_ERROR,
  STAFF_MFA_FACTOR_STATUS,
  STAFF_ROLE,
  STAFF_SECURITY_AUDIT_EVENT_TYPE,
  STAFF_SESSION_LIST_MAX,
  STAFF_STATUS,
  StaffAdminError,
  authorizeStaffAdministration,
  clampEditorListLimit,
  decideDisableStaffMfa,
  decideRequireStaffPasswordReset,
  decideRevokeAllStaffSessions,
  decideStaffAccountStatusChange,
  decideStaffRoleChange,
  decideStaffScopeChange,
  decideStaffSessionRevoke,
  encodeEditorListCursor,
  nextMonotonicUpdatedAt,
  sanitizeEditorSearch,
  staffSecurityAuditOmitsSecrets,
  toSafeStaffAccountProjection,
  toSafeStaffSessionProjection,
  type EditorListCursor,
  type SafeStaffAccountProjection,
  type SafeStaffSessionProjection,
  type StaffMfaFactorRecord,
  type StaffRole,
  type StaffScopeMode,
  type StaffSecurityAuditEventType,
  type StaffStatus,
} from "@magazine/domain";
import { invalidateLoginChallengesForStaff } from "./staff-mfa";
import { getDb } from "./client";
import { categories } from "./schema/taxonomy";
import {
  staffLoginChallenges,
  staffMfaFactors,
  staffMfaRecoveryCodes,
  staffMfaSecrets,
  staffPasswordCredentials,
  staffSecurityAuditEvents,
  staffSessions,
  staffUserCategoryScopes,
  staffUserRoles,
  staffUsers,
} from "./schema/staff";

export type StaffAdminActor = {
  staffUserId: string;
  roles: readonly StaffRole[];
  currentSessionId?: string | null;
};

function unwrap<T>(
  decision: { ok: true; value: T } | { ok: false; code: string },
): T {
  if (!decision.ok) {
    throw new StaffAdminError(decision.code as never);
  }
  return decision.value;
}

function assertSafeChangeSet(
  changeSet: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!staffSecurityAuditOmitsSecrets(changeSet)) {
    throw new StaffAdminError(
      STAFF_ADMIN_ERROR.FORBIDDEN,
      "Security audit change set must not include secrets.",
    );
  }
  return changeSet;
}

async function lockStaffUser(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  staffUserId: string,
) {
  const [row] = await tx
    .select()
    .from(staffUsers)
    .where(eq(staffUsers.id, staffUserId))
    .for("update");
  if (!row) {
    throw new StaffAdminError(STAFF_ADMIN_ERROR.STAFF_NOT_FOUND);
  }
  return row;
}

async function lockViableSuperAdminRows(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
) {
  await tx.execute(sql`
    SELECT u.id
    FROM staff_users u
    INNER JOIN staff_user_roles r ON r.staff_user_id = u.id
    WHERE r.role = 'SUPER_ADMIN'
    FOR UPDATE OF u
  `);
}

async function countViableSuperAdmins(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
): Promise<number> {
  const [row] = await tx
    .select({ value: sql<number>`count(*)::int` })
    .from(staffUsers)
    .innerJoin(staffUserRoles, eq(staffUserRoles.staffUserId, staffUsers.id))
    .where(
      and(
        eq(staffUsers.status, STAFF_STATUS.ACTIVE),
        eq(staffUserRoles.role, STAFF_ROLE.SUPER_ADMIN),
      ),
    );
  return row?.value ?? 0;
}

async function loadRoles(
  executor: ReturnType<typeof getDb> | Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  staffUserId: string,
): Promise<StaffRole[]> {
  const rows = await executor
    .select({ role: staffUserRoles.role })
    .from(staffUserRoles)
    .where(eq(staffUserRoles.staffUserId, staffUserId));
  return rows.map((row) => row.role);
}

async function loadScopedCategoryIds(
  executor: ReturnType<typeof getDb> | Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  staffUserId: string,
): Promise<string[]> {
  const rows = await executor
    .select({ categoryId: staffUserCategoryScopes.categoryId })
    .from(staffUserCategoryScopes)
    .where(eq(staffUserCategoryScopes.staffUserId, staffUserId));
  return rows.map((row) => row.categoryId);
}

async function loadMfaRecord(
  executor: ReturnType<typeof getDb> | Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  staffUserId: string,
): Promise<StaffMfaFactorRecord | null> {
  const [factor] = await executor
    .select({
      id: staffMfaFactors.id,
      kind: staffMfaFactors.kind,
      status: staffMfaFactors.status,
      confirmedAt: staffMfaFactors.confirmedAt,
      disabledAt: staffMfaFactors.disabledAt,
    })
    .from(staffMfaFactors)
    .where(eq(staffMfaFactors.staffUserId, staffUserId))
    .limit(1);

  if (!factor) {
    return null;
  }

  const [unused] = await executor
    .select({ value: sql<number>`count(*)::int` })
    .from(staffMfaRecoveryCodes)
    .where(
      and(
        eq(staffMfaRecoveryCodes.factorId, factor.id),
        isNull(staffMfaRecoveryCodes.usedAt),
      ),
    );

  return {
    kind: factor.kind,
    status: factor.status,
    confirmedAt: factor.confirmedAt,
    disabledAt: factor.disabledAt,
    unusedRecoveryCodeCount: unused?.value ?? 0,
  };
}

async function projectAccount(
  executor: ReturnType<typeof getDb> | Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  user: typeof staffUsers.$inferSelect,
): Promise<SafeStaffAccountProjection> {
  const [credential] = await executor
    .select({
      passwordChangedAt: staffPasswordCredentials.passwordChangedAt,
      failedLoginCount: staffPasswordCredentials.failedLoginCount,
      lockedUntil: staffPasswordCredentials.lockedUntil,
    })
    .from(staffPasswordCredentials)
    .where(eq(staffPasswordCredentials.staffUserId, user.id))
    .limit(1);

  return toSafeStaffAccountProjection({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
    scopeMode: user.scopeMode,
    roles: await loadRoles(executor, user.id),
    scopedCategoryIds: await loadScopedCategoryIds(executor, user.id),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    disabledAt: user.disabledAt,
    passwordChangedAt: credential?.passwordChangedAt ?? null,
    passwordResetRequiredAt: user.passwordResetRequiredAt,
    failedLoginCount: credential?.failedLoginCount ?? null,
    lockedUntil: credential?.lockedUntil ?? null,
    mfa: await loadMfaRecord(executor, user.id),
  });
}

async function appendSecurityAudit(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  input: {
    subjectStaffUserId: string;
    actorStaffUserId: string;
    eventType: StaffSecurityAuditEventType;
    changeSet: Record<string, unknown> | null;
  },
) {
  await tx.insert(staffSecurityAuditEvents).values({
    subjectStaffUserId: input.subjectStaffUserId,
    eventType: input.eventType,
    actorKind: CONTENT_AUDIT_ACTOR_KIND.STAFF,
    actorStaffUserId: input.actorStaffUserId,
    changeSet: assertSafeChangeSet(input.changeSet),
  });
}

async function revokeSessionsForUser(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  staffUserId: string,
  now: Date,
  preserveSessionId: string | null,
): Promise<string[]> {
  const rows = await tx
    .select({ id: staffSessions.id })
    .from(staffSessions)
    .where(
      and(
        eq(staffSessions.staffUserId, staffUserId),
        isNull(staffSessions.revokedAt),
      ),
    );

  const ids = rows
    .map((row) => row.id)
    .filter((id) => id !== preserveSessionId);
  if (ids.length === 0) {
    return [];
  }

  await tx
    .update(staffSessions)
    .set({ revokedAt: now })
    .where(inArray(staffSessions.id, ids));
  return ids;
}

export async function getStaffAccount(input: {
  actor: StaffAdminActor;
  staffUserId: string;
}): Promise<SafeStaffAccountProjection> {
  unwrap(authorizeStaffAdministration({ roles: input.actor.roles }));
  const db = getDb();
  const [user] = await db
    .select()
    .from(staffUsers)
    .where(eq(staffUsers.id, input.staffUserId))
    .limit(1);
  if (!user) {
    throw new StaffAdminError(STAFF_ADMIN_ERROR.STAFF_NOT_FOUND);
  }
  return projectAccount(db, user);
}

export type ListStaffAccountsResult = {
  items: SafeStaffAccountProjection[];
  nextCursor: string | null;
};

export async function listStaffAccounts(input: {
  actor: StaffAdminActor;
  search?: string | null;
  status?: StaffStatus;
  role?: StaffRole;
  scopeMode?: StaffScopeMode;
  limit?: number;
  cursor?: EditorListCursor | null;
}): Promise<ListStaffAccountsResult> {
  unwrap(authorizeStaffAdministration({ roles: input.actor.roles }));
  const db = getDb();
  const limit = clampEditorListLimit(input.limit);
  const filters = [];
  if (input.status) {
    filters.push(eq(staffUsers.status, input.status));
  }
  if (input.role) {
    filters.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(staffUserRoles)
          .where(
            and(
              eq(staffUserRoles.staffUserId, staffUsers.id),
              eq(staffUserRoles.role, input.role),
            ),
          ),
      ),
    );
  }
  if (input.scopeMode) {
    filters.push(eq(staffUsers.scopeMode, input.scopeMode));
  }
  const search = sanitizeEditorSearch(input.search ?? undefined);
  if (search) {
    const pattern = `%${search}%`;
    filters.push(
      or(ilike(staffUsers.email, pattern), ilike(staffUsers.displayName, pattern))!,
    );
  }
  if (input.cursor) {
    const cursorUpdatedAt = new Date(input.cursor.updatedAt);
    const cursorClause = or(
      lt(staffUsers.updatedAt, cursorUpdatedAt),
      and(
        eq(staffUsers.updatedAt, cursorUpdatedAt),
        lt(staffUsers.id, input.cursor.id),
      ),
    );
    if (cursorClause) {
      filters.push(cursorClause);
    }
  }

  const rows = await db
    .select()
    .from(staffUsers)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(staffUsers.updatedAt), desc(staffUsers.id))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const items = await Promise.all(page.map((row) => projectAccount(db, row)));
  const last = page[page.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? encodeEditorListCursor({ updatedAt: last.updatedAt, id: last.id })
        : null,
  };
}

export async function setStaffAccountStatus(input: {
  actor: StaffAdminActor;
  staffUserId: string;
  status: string;
  expectedUpdatedAt: Date | string;
  now?: Date;
}): Promise<SafeStaffAccountProjection> {
  unwrap(authorizeStaffAdministration({ roles: input.actor.roles }));
  const now = input.now ?? new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    const user = await lockStaffUser(tx, input.staffUserId);
    const roles = await loadRoles(tx, user.id);
    await lockViableSuperAdminRows(tx);
    const plan = unwrap(
      decideStaffAccountStatusChange({
        actorRoles: input.actor.roles,
        current: {
          status: user.status,
          roles,
          updatedAt: user.updatedAt,
        },
        nextStatus: input.status,
        expectedUpdatedAt: input.expectedUpdatedAt,
        viableSuperAdminCount: await countViableSuperAdmins(tx),
      }),
    );

    const nextUpdatedAt = nextMonotonicUpdatedAt(user.updatedAt, now);
    const [updated] = await tx
      .update(staffUsers)
      .set({
        status: plan.nextStatus,
        disabledAt: plan.disable ? now : null,
        updatedAt: nextUpdatedAt,
      })
      .where(eq(staffUsers.id, user.id))
      .returning();
    if (!updated) {
      throw new StaffAdminError(STAFF_ADMIN_ERROR.STAFF_NOT_FOUND);
    }

    let revokedSessionIds: string[] = [];
    if (plan.revokeAllSessions) {
      revokedSessionIds = await revokeSessionsForUser(tx, user.id, now, null);
      await invalidateLoginChallengesForStaff(tx, user.id, now);
    }

    await appendSecurityAudit(tx, {
      subjectStaffUserId: user.id,
      actorStaffUserId: input.actor.staffUserId,
      eventType: plan.auditEventType,
      changeSet: {
        fromStatus: user.status,
        toStatus: plan.nextStatus,
        revokedSessionCount: revokedSessionIds.length,
      },
    });

    return projectAccount(tx, updated);
  });
}

export async function setStaffRoles(input: {
  actor: StaffAdminActor;
  staffUserId: string;
  roles: readonly string[];
  expectedUpdatedAt: Date | string;
  now?: Date;
}): Promise<SafeStaffAccountProjection> {
  unwrap(authorizeStaffAdministration({ roles: input.actor.roles }));
  const now = input.now ?? new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    const user = await lockStaffUser(tx, input.staffUserId);
    const currentRoles = await loadRoles(tx, user.id);
    await lockViableSuperAdminRows(tx);
    const plan = unwrap(
      decideStaffRoleChange({
        actorRoles: input.actor.roles,
        current: {
          status: user.status,
          roles: currentRoles,
          updatedAt: user.updatedAt,
        },
        nextRoles: input.roles,
        expectedUpdatedAt: input.expectedUpdatedAt,
        viableSuperAdminCount: await countViableSuperAdmins(tx),
      }),
    );

    await tx
      .delete(staffUserRoles)
      .where(eq(staffUserRoles.staffUserId, user.id));
    await tx.insert(staffUserRoles).values(
      plan.nextRoles.map((role) => ({ staffUserId: user.id, role })),
    );

    const nextUpdatedAt = nextMonotonicUpdatedAt(user.updatedAt, now);
    const [updated] = await tx
      .update(staffUsers)
      .set({ updatedAt: nextUpdatedAt })
      .where(eq(staffUsers.id, user.id))
      .returning();
    if (!updated) {
      throw new StaffAdminError(STAFF_ADMIN_ERROR.STAFF_NOT_FOUND);
    }

    await appendSecurityAudit(tx, {
      subjectStaffUserId: user.id,
      actorStaffUserId: input.actor.staffUserId,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_ROLE_CHANGED,
      changeSet: {
        fromRoles: currentRoles,
        toRoles: plan.nextRoles,
      },
    });

    return projectAccount(tx, updated);
  });
}

export async function setStaffScope(input: {
  actor: StaffAdminActor;
  staffUserId: string;
  scopeMode: string;
  scopedCategoryIds: readonly string[];
  expectedUpdatedAt: Date | string;
  now?: Date;
}): Promise<SafeStaffAccountProjection> {
  unwrap(authorizeStaffAdministration({ roles: input.actor.roles }));
  const now = input.now ?? new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    const user = await lockStaffUser(tx, input.staffUserId);
    const currentIds = await loadScopedCategoryIds(tx, user.id);
    const plan = unwrap(
      decideStaffScopeChange({
        actorRoles: input.actor.roles,
        currentUpdatedAt: user.updatedAt,
        expectedUpdatedAt: input.expectedUpdatedAt,
        scopeMode: input.scopeMode,
        scopedCategoryIds: input.scopedCategoryIds,
      }),
    );

    if (plan.scopedCategoryIds.length > 0) {
      const found = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(inArray(categories.id, plan.scopedCategoryIds));
      if (found.length !== plan.scopedCategoryIds.length) {
        throw new StaffAdminError(STAFF_ADMIN_ERROR.INVALID_SCOPE);
      }
    }

    await tx
      .delete(staffUserCategoryScopes)
      .where(eq(staffUserCategoryScopes.staffUserId, user.id));
    if (plan.scopedCategoryIds.length > 0) {
      await tx.insert(staffUserCategoryScopes).values(
        plan.scopedCategoryIds.map((categoryId) => ({
          staffUserId: user.id,
          categoryId,
        })),
      );
    }

    const nextUpdatedAt = nextMonotonicUpdatedAt(user.updatedAt, now);
    const [updated] = await tx
      .update(staffUsers)
      .set({
        scopeMode: plan.scopeMode,
        updatedAt: nextUpdatedAt,
      })
      .where(eq(staffUsers.id, user.id))
      .returning();
    if (!updated) {
      throw new StaffAdminError(STAFF_ADMIN_ERROR.STAFF_NOT_FOUND);
    }

    await appendSecurityAudit(tx, {
      subjectStaffUserId: user.id,
      actorStaffUserId: input.actor.staffUserId,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SCOPE_CHANGED,
      changeSet: {
        fromScopeMode: user.scopeMode,
        toScopeMode: plan.scopeMode,
        fromCategoryCount: currentIds.length,
        toCategoryCount: plan.scopedCategoryIds.length,
      },
    });

    return projectAccount(tx, updated);
  });
}

export async function listStaffSessions(input: {
  actor: StaffAdminActor;
  staffUserId: string;
  now?: Date;
}): Promise<SafeStaffSessionProjection[]> {
  unwrap(authorizeStaffAdministration({ roles: input.actor.roles }));
  const now = input.now ?? new Date();
  const db = getDb();
  const [user] = await db
    .select({ id: staffUsers.id })
    .from(staffUsers)
    .where(eq(staffUsers.id, input.staffUserId))
    .limit(1);
  if (!user) {
    throw new StaffAdminError(STAFF_ADMIN_ERROR.STAFF_NOT_FOUND);
  }

  const rows = await db
    .select({
      id: staffSessions.id,
      createdAt: staffSessions.createdAt,
      lastSeenAt: staffSessions.lastSeenAt,
      expiresAt: staffSessions.expiresAt,
      revokedAt: staffSessions.revokedAt,
    })
    .from(staffSessions)
    .where(eq(staffSessions.staffUserId, input.staffUserId))
    .orderBy(
      sql`${staffSessions.revokedAt} IS NULL DESC`,
      desc(staffSessions.lastSeenAt),
      desc(staffSessions.id),
    )
    .limit(STAFF_SESSION_LIST_MAX);

  return rows.map((row) => toSafeStaffSessionProjection({ ...row, now }));
}

export async function revokeStaffSession(input: {
  actor: StaffAdminActor;
  staffUserId: string;
  sessionId: string;
  now?: Date;
}): Promise<{ revoked: boolean }> {
  unwrap(authorizeStaffAdministration({ roles: input.actor.roles }));
  const now = input.now ?? new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    const [session] = await tx
      .select({
        id: staffSessions.id,
        staffUserId: staffSessions.staffUserId,
        revokedAt: staffSessions.revokedAt,
      })
      .from(staffSessions)
      .where(eq(staffSessions.id, input.sessionId))
      .for("update");

    unwrap(
      decideStaffSessionRevoke({
        actorRoles: input.actor.roles,
        sessionBelongsToTarget: session?.staffUserId === input.staffUserId,
      }),
    );

    if (!session) {
      throw new StaffAdminError(STAFF_ADMIN_ERROR.SESSION_NOT_FOUND);
    }
    if (session.revokedAt) {
      return { revoked: false };
    }

    await tx
      .update(staffSessions)
      .set({ revokedAt: now })
      .where(
        and(eq(staffSessions.id, session.id), isNull(staffSessions.revokedAt)),
      );

    await appendSecurityAudit(tx, {
      subjectStaffUserId: input.staffUserId,
      actorStaffUserId: input.actor.staffUserId,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SESSION_REVOKED,
      changeSet: { sessionId: session.id },
    });

    return { revoked: true };
  });
}

export async function revokeAllStaffSessions(input: {
  actor: StaffAdminActor;
  staffUserId: string;
  now?: Date;
}): Promise<{ revokedSessionCount: number; preservedSessionId: string | null }> {
  unwrap(authorizeStaffAdministration({ roles: input.actor.roles }));
  const now = input.now ?? new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    await lockStaffUser(tx, input.staffUserId);
    const plan = unwrap(
      decideRevokeAllStaffSessions({
        actorRoles: input.actor.roles,
        actorStaffUserId: input.actor.staffUserId,
        targetStaffUserId: input.staffUserId,
        currentSessionId: input.actor.currentSessionId ?? null,
      }),
    );

    const revokedIds = await revokeSessionsForUser(
      tx,
      input.staffUserId,
      now,
      plan.preserveSessionId,
    );

    await appendSecurityAudit(tx, {
      subjectStaffUserId: input.staffUserId,
      actorStaffUserId: input.actor.staffUserId,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SESSIONS_REVOKED_ALL,
      changeSet: {
        revokedSessionCount: revokedIds.length,
        preservedCurrentSession: plan.preserveSessionId !== null,
      },
    });

    return {
      revokedSessionCount: revokedIds.length,
      preservedSessionId: plan.preserveSessionId,
    };
  });
}

export async function requireStaffPasswordReset(input: {
  actor: StaffAdminActor;
  staffUserId: string;
  expectedUpdatedAt: Date | string;
  now?: Date;
}): Promise<SafeStaffAccountProjection> {
  unwrap(authorizeStaffAdministration({ roles: input.actor.roles }));
  const now = input.now ?? new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    const user = await lockStaffUser(tx, input.staffUserId);
    unwrap(
      decideRequireStaffPasswordReset({
        actorRoles: input.actor.roles,
        currentUpdatedAt: user.updatedAt,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    );

    const nextUpdatedAt = nextMonotonicUpdatedAt(user.updatedAt, now);
    const [updated] = await tx
      .update(staffUsers)
      .set({
        passwordResetRequiredAt: now,
        updatedAt: nextUpdatedAt,
      })
      .where(eq(staffUsers.id, user.id))
      .returning();
    if (!updated) {
      throw new StaffAdminError(STAFF_ADMIN_ERROR.STAFF_NOT_FOUND);
    }

    const revokedIds = await revokeSessionsForUser(tx, user.id, now, null);
    await invalidateLoginChallengesForStaff(tx, user.id, now);
    await appendSecurityAudit(tx, {
      subjectStaffUserId: user.id,
      actorStaffUserId: input.actor.staffUserId,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_PASSWORD_RESET_REQUIRED,
      changeSet: { revokedSessionCount: revokedIds.length },
    });

    return projectAccount(tx, updated);
  });
}

export async function disableStaffMfa(input: {
  actor: StaffAdminActor;
  staffUserId: string;
  expectedUpdatedAt: Date | string;
  now?: Date;
}): Promise<SafeStaffAccountProjection> {
  unwrap(authorizeStaffAdministration({ roles: input.actor.roles }));
  const now = input.now ?? new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    const user = await lockStaffUser(tx, input.staffUserId);
    const [factor] = await tx
      .select({
        id: staffMfaFactors.id,
        status: staffMfaFactors.status,
      })
      .from(staffMfaFactors)
      .where(eq(staffMfaFactors.staffUserId, user.id))
      .limit(1);

    unwrap(
      decideDisableStaffMfa({
        actorRoles: input.actor.roles,
        currentUpdatedAt: user.updatedAt,
        expectedUpdatedAt: input.expectedUpdatedAt,
        factorStatus: factor?.status ?? null,
      }),
    );
    if (!factor) {
      throw new StaffAdminError(STAFF_ADMIN_ERROR.MFA_NOT_ENROLLED);
    }

    const factorId = factor.id;
    const previousStatus = factor.status;

    await tx
      .update(staffMfaFactors)
      .set({
        status: STAFF_MFA_FACTOR_STATUS.DISABLED,
        disabledAt: now,
      })
      .where(eq(staffMfaFactors.id, factorId));

    await tx.delete(staffMfaSecrets).where(eq(staffMfaSecrets.factorId, factorId));
    await tx
      .delete(staffMfaRecoveryCodes)
      .where(eq(staffMfaRecoveryCodes.factorId, factorId));

    await tx
      .update(staffLoginChallenges)
      .set({ consumedAt: now })
      .where(
        and(
          eq(staffLoginChallenges.staffUserId, user.id),
          isNull(staffLoginChallenges.consumedAt),
        ),
      );

    const nextUpdatedAt = nextMonotonicUpdatedAt(user.updatedAt, now);
    const [updated] = await tx
      .update(staffUsers)
      .set({ updatedAt: nextUpdatedAt })
      .where(eq(staffUsers.id, user.id))
      .returning();
    if (!updated) {
      throw new StaffAdminError(STAFF_ADMIN_ERROR.STAFF_NOT_FOUND);
    }

    await appendSecurityAudit(tx, {
      subjectStaffUserId: user.id,
      actorStaffUserId: input.actor.staffUserId,
      eventType: STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_MFA_DISABLED,
      changeSet: {
        previousStatus,
        nextStatus: STAFF_MFA_FACTOR_STATUS.DISABLED,
      },
    });

    return projectAccount(tx, updated);
  });
}

export type StaffSecurityAuditEvent = {
  id: string;
  subjectStaffUserId: string;
  eventType: StaffSecurityAuditEventType;
  actorKind: string;
  actorStaffUserId: string | null;
  occurredAt: Date;
  changeSet: Record<string, unknown> | null;
};

export async function listStaffSecurityAuditEvents(input: {
  actor: StaffAdminActor;
  staffUserId: string;
}): Promise<StaffSecurityAuditEvent[]> {
  unwrap(authorizeStaffAdministration({ roles: input.actor.roles }));
  const db = getDb();
  const rows = await db
    .select({
      id: staffSecurityAuditEvents.id,
      subjectStaffUserId: staffSecurityAuditEvents.subjectStaffUserId,
      eventType: staffSecurityAuditEvents.eventType,
      actorKind: staffSecurityAuditEvents.actorKind,
      actorStaffUserId: staffSecurityAuditEvents.actorStaffUserId,
      occurredAt: staffSecurityAuditEvents.occurredAt,
      changeSet: staffSecurityAuditEvents.changeSet,
    })
    .from(staffSecurityAuditEvents)
    .where(eq(staffSecurityAuditEvents.subjectStaffUserId, input.staffUserId))
    .orderBy(desc(staffSecurityAuditEvents.occurredAt), desc(staffSecurityAuditEvents.id));

  return rows.map((row) => ({
    ...row,
    eventType: row.eventType as StaffSecurityAuditEventType,
    changeSet: (row.changeSet as Record<string, unknown> | null) ?? null,
  }));
}

export type { StaffScopeMode, StaffStatus };
