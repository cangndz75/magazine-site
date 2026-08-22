import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
  REDIRECT_ERROR,
  REDIRECT_RESOLUTION,
  RedirectError,
  STAFF_ROLE,
  STAFF_SCOPE_MODE,
  STAFF_STATUS,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  createRedirectRule,
  listRedirectRules,
  resolvePublicRedirect,
  updateRedirectRule,
  type RedirectActor,
} from "../redirects";
import {
  redirectRuleAuditEvents,
  redirectRules,
  staffUsers,
} from "../schema";
import {
  cleanupStaffAuthTables,
  closeIntegrationConnections,
  ensureEditorContentTestDatabase,
} from "./harness";

function assertRedirectCode(error: unknown, code: string): boolean {
  assert.equal(error instanceof RedirectError, true, String(error));
  assert.equal((error as RedirectError).code, code);
  return true;
}

describe("redirect management PostgreSQL foundation", () => {
  let actor: RedirectActor;

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    await cleanupRedirects();
    await cleanupStaffAuthTables();
    const staffUserId = randomUUID();
    await getDb().insert(staffUsers).values({
      id: staffUserId,
      email: `redirects-${staffUserId}@example.test`,
      displayName: "Redirect Publisher",
      status: STAFF_STATUS.ACTIVE,
      scopeMode: STAFF_SCOPE_MODE.ALL,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    actor = { staffUserId, roles: [STAFF_ROLE.SUPER_ADMIN] };
  });

  afterEach(async () => {
    await cleanupRedirects();
    await cleanupStaffAuthTables();
  });

  after(async () => {
    await closeIntegrationConnections();
  });

  it("creates, resolves, audits, and lists bounded manual redirects", async () => {
    const created = await createRedirectRule({
      actor,
      sourcePath: "/old-section/story",
      targetPath: "/new-section/story",
      now: new Date("2026-08-22T10:00:00.000Z"),
    });
    assert.equal(created.status, "PERMANENT");

    assert.deepEqual(await resolvePublicRedirect("/old-section/story"), {
      kind: REDIRECT_RESOLUTION.REDIRECT,
      targetPath: "/new-section/story",
      statusCode: 308,
    });
    assert.deepEqual(await resolvePublicRedirect("/missing-section/story"), {
      kind: REDIRECT_RESOLUTION.NONE,
    });

    const audit = await getDb()
      .select()
      .from(redirectRuleAuditEvents)
      .where(eq(redirectRuleAuditEvents.redirectRuleId, created.id));
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.actorStaffUserId, actor.staffUserId);
    assert.equal(audit[0]?.sourcePath, "/old-section/story");

    const list = await listRedirectRules({ actor, limit: 1 });
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0]?.sourcePath, "/old-section/story");
  });

  it("rejects duplicate sources, chains, and stale writes", async () => {
    const first = await createRedirectRule({
      actor,
      sourcePath: "/a/path",
      targetPath: "/b/path",
    });

    await assert.rejects(
      createRedirectRule({
        actor,
        sourcePath: "/a/path/",
        targetPath: "/c/path",
      }),
      (error) => assertRedirectCode(error, REDIRECT_ERROR.SOURCE_CONFLICT),
    );

    await assert.rejects(
      createRedirectRule({
        actor,
        sourcePath: "/b/path",
        targetPath: "/c/path",
      }),
      (error) => assertRedirectCode(error, REDIRECT_ERROR.REDIRECT_CHAIN),
    );

    const updated = await updateRedirectRule({
      actor,
      id: first.id,
      targetPath: "/d/path",
      expectedUpdatedAt: first.updatedAt,
    });
    await assert.rejects(
      updateRedirectRule({
        actor,
        id: first.id,
        targetPath: "/e/path",
        expectedUpdatedAt: first.updatedAt,
      }),
      (error) => assertRedirectCode(error, REDIRECT_ERROR.WRITE_CONFLICT),
    );
    assert.equal(updated.targetPath, "/d/path");
  });

  it("keeps redirect mutations behind publish authority", async () => {
    await assert.rejects(
      createRedirectRule({
        actor: { staffUserId: actor.staffUserId, roles: [STAFF_ROLE.AUTHOR] },
        sourcePath: "/old/private",
        targetPath: "/new/private",
      }),
      (error) => assertRedirectCode(error, REDIRECT_ERROR.FORBIDDEN),
    );
  });
});

async function cleanupRedirects(): Promise<void> {
  await getDb().delete(redirectRuleAuditEvents);
  await getDb().delete(redirectRules);
}
