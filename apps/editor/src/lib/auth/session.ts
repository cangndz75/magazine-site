import "server-only";

import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@magazine/db/client";
import {
  staffSessions,
  staffUserCategoryScopes,
  staffUserRoles,
  staffUsers,
} from "@magazine/db/schema";
import {
  SESSION_LIFETIME_MS,
  evaluateStaffSession,
  generateSessionToken,
  hashSessionToken,
  type StaffRole,
} from "@magazine/domain";
import { env } from "@/lib/env";
import { sessionCookieClearOptions, sessionCookieName, sessionCookieOptions } from "./cookies";

export type StaffSessionContext = {
  sessionId: string;
  staffUserId: string;
  email: string;
  displayName: string;
  status: "ACTIVE" | "DISABLED";
  scopeMode: "ALL" | "SELECTED";
  roles: StaffRole[];
  scopedCategoryIds: string[];
};

/**
 * Future MFA can sit between password verification and this session.
 * This pass treats a stored unrevoked session as fully authenticated.
 */
export async function createStaffSession(staffUserId: string): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_MS);
  const db = getDb();

  await db.insert(staffSessions).values({
    staffUserId,
    tokenHash,
    createdAt: now,
    expiresAt,
    lastSeenAt: now,
  });

  return token;
}

export async function readSessionTokenFromCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(sessionCookieName(env.APP_ENV))?.value;
}

export async function getCurrentStaffSession(): Promise<StaffSessionContext | null> {
  const token = await readSessionTokenFromCookie();
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const db = getDb();
  const now = new Date();

  const [row] = await db
    .select({
      sessionId: staffSessions.id,
      staffUserId: staffSessions.staffUserId,
      revokedAt: staffSessions.revokedAt,
      expiresAt: staffSessions.expiresAt,
      email: staffUsers.email,
      displayName: staffUsers.displayName,
      status: staffUsers.status,
      scopeMode: staffUsers.scopeMode,
    })
    .from(staffSessions)
    .innerJoin(staffUsers, eq(staffSessions.staffUserId, staffUsers.id))
    .where(eq(staffSessions.tokenHash, tokenHash))
    .limit(1);

  if (!row) {
    return null;
  }

  const validity = evaluateStaffSession({
    revokedAt: row.revokedAt,
    expiresAt: row.expiresAt,
    now,
    staffStatus: row.status,
  });

  if (!validity.ok) {
    return null;
  }

  const roleRows = await db
    .select({ role: staffUserRoles.role })
    .from(staffUserRoles)
    .where(eq(staffUserRoles.staffUserId, row.staffUserId));

  const scopeRows = await db
    .select({ categoryId: staffUserCategoryScopes.categoryId })
    .from(staffUserCategoryScopes)
    .where(eq(staffUserCategoryScopes.staffUserId, row.staffUserId));

  await db
    .update(staffSessions)
    .set({ lastSeenAt: now })
    .where(
      and(eq(staffSessions.id, row.sessionId), isNull(staffSessions.revokedAt)),
    );

  return {
    sessionId: row.sessionId,
    staffUserId: row.staffUserId,
    email: row.email,
    displayName: row.displayName,
    status: row.status,
    scopeMode: row.scopeMode,
    roles: roleRows.map((item) => item.role),
    scopedCategoryIds: scopeRows.map((item) => item.categoryId),
  };
}

export async function revokeStaffSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(staffSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(staffSessions.id, sessionId), isNull(staffSessions.revokedAt)));
}

export async function applySessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(
    sessionCookieName(env.APP_ENV),
    token,
    sessionCookieOptions(env.APP_ENV),
  );
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(
    sessionCookieName(env.APP_ENV),
    "",
    sessionCookieClearOptions(env.APP_ENV),
  );
}
