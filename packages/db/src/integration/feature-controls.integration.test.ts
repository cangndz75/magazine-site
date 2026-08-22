import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { eq, sql } from "drizzle-orm";
import {
  FEATURE_CONTROL_ERROR,
  FEATURE_FLAG_KEY,
  FeatureControlError,
  KILL_SWITCH_KEY,
  STAFF_ROLE,
  STAFF_SCOPE_MODE,
  STAFF_STATUS,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  getFeatureControl,
  isFeatureEnabled,
  isKillSwitchActive,
  updateFeatureControl,
  type FeatureControlActor,
} from "../feature-controls";
import {
  featureControlAuditEvents,
  featureControls,
  staffUsers,
} from "../schema";
import {
  cleanupStaffAuthTables,
  closeIntegrationConnections,
  ensureEditorContentTestDatabase,
} from "./harness";

function assertControlCode(error: unknown, code: string): void {
  assert.equal(error instanceof FeatureControlError, true, String(error));
  assert.equal((error as FeatureControlError).code, code);
}

describe("feature controls PostgreSQL foundation", () => {
  let actor: FeatureControlActor;

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    await resetFeatureControls();
    await cleanupStaffAuthTables();
    const staffUserId = randomUUID();
    await getDb().insert(staffUsers).values({
      id: staffUserId,
      email: `feature-controls-${staffUserId}@example.test`,
      displayName: "Feature Controls Admin",
      status: STAFF_STATUS.ACTIVE,
      scopeMode: STAFF_SCOPE_MODE.ALL,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    actor = {
      staffUserId,
      roles: [STAFF_ROLE.SUPER_ADMIN],
    };
  });

  afterEach(async () => {
    await resetFeatureControls();
    await cleanupStaffAuthTables();
  });

  after(async () => {
    await closeIntegrationConnections();
  });

  it("seeds only known controls with safe defaults", async () => {
    assert.equal(await isFeatureEnabled(FEATURE_FLAG_KEY.PUBLIC_SEARCH), true);
    assert.equal(await isKillSwitchActive(KILL_SWITCH_KEY.PUBLIC_VIDEO), false);

    await assert.rejects(
      getDb().execute(sql`
        insert into feature_controls ("key", "type", "enabled", "description")
        values ('UNKNOWN_FLAG', 'FEATURE_FLAG', true, 'Unknown')
      `),
    );
  });

  it("persists updates with optimistic concurrency and audit evidence", async () => {
    const current = await getFeatureControl(KILL_SWITCH_KEY.PUBLIC_VIDEO);
    assert.equal(current.enabled, false);
    assert.notEqual(current.updatedAt, null);

    const updated = await updateFeatureControl({
      key: KILL_SWITCH_KEY.PUBLIC_VIDEO,
      enabled: true,
      expectedUpdatedAt: current.updatedAt as string,
      actor,
      now: new Date("2026-08-22T10:00:00.000Z"),
    });

    assert.equal(updated.enabled, true);
    assert.equal(await isKillSwitchActive(KILL_SWITCH_KEY.PUBLIC_VIDEO), true);

    const audit = await getDb()
      .select()
      .from(featureControlAuditEvents)
      .where(eq(featureControlAuditEvents.controlKey, KILL_SWITCH_KEY.PUBLIC_VIDEO));
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.actorStaffUserId, actor.staffUserId);
    assert.equal(audit[0]?.oldEnabled, false);
    assert.equal(audit[0]?.newEnabled, true);

    await assert.rejects(
      updateFeatureControl({
        key: KILL_SWITCH_KEY.PUBLIC_VIDEO,
        enabled: false,
        expectedUpdatedAt: current.updatedAt as string,
        actor,
      }),
      (error) => {
        assertControlCode(error, FEATURE_CONTROL_ERROR.WRITE_CONFLICT);
        return true;
      },
    );
  });

  it("rejects non-Super Admin writes", async () => {
    const current = await getFeatureControl(FEATURE_FLAG_KEY.PUBLIC_SEARCH);
    await assert.rejects(
      updateFeatureControl({
        key: FEATURE_FLAG_KEY.PUBLIC_SEARCH,
        enabled: false,
        expectedUpdatedAt: current.updatedAt as string,
        actor: {
          staffUserId: actor.staffUserId,
          roles: [STAFF_ROLE.EDITOR],
        },
      }),
      (error) => {
        assertControlCode(error, FEATURE_CONTROL_ERROR.FORBIDDEN);
        return true;
      },
    );
  });
});

async function resetFeatureControls(): Promise<void> {
  const db = getDb();
  await db.delete(featureControlAuditEvents);
  await db
    .update(featureControls)
    .set({
      updatedByStaffUserId: null,
    });
  await db.execute(sql`
    update feature_controls
    set enabled = case
        when type = 'FEATURE_FLAG' then true
        else false
      end,
      description = case "key"
        when 'PUBLIC_SEARCH' then 'Controls public search result serving.'
        when 'PUBLIC_GALLERIES' then 'Controls public photo gallery serving.'
        when 'EDITORIAL_CALENDAR' then 'Controls the editorial calendar server surface.'
        when 'ANALYTICS_INGESTION' then 'Stops public analytics ingestion when enabled.'
        when 'SCHEDULED_PUBLISHING' then 'Stops scheduled publishing execution when enabled.'
        when 'PUBLIC_VIDEO' then 'Hides public hosted video projections when enabled.'
        when 'HOMEPAGE_CONVERSATION' then 'Hides the public homepage conversation rail when enabled.'
        else description
      end,
      updated_at = now()
  `);
}
