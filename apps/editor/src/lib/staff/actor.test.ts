import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_ROLE } from "@magazine/domain";
import {
  currentSessionIdForRevokeAll,
  staffAdminActorFromSession,
} from "./actor";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_SESSION = "33333333-3333-4333-8333-333333333333";
const FORGED_SESSION = "44444444-4444-4444-8444-444444444444";

describe("staff admin actor", () => {
  it("copies identity only from the authenticated session", () => {
    const actor = staffAdminActorFromSession({
      staffUserId: ACTOR_ID,
      roles: [STAFF_ROLE.SUPER_ADMIN],
      sessionId: ACTOR_SESSION,
    });
    assert.equal(actor.staffUserId, ACTOR_ID);
    assert.deepEqual(actor.roles, [STAFF_ROLE.SUPER_ADMIN]);
    assert.equal(actor.currentSessionId, null);
  });

  it("preserves the caller session on self revoke-all by default", () => {
    assert.equal(
      currentSessionIdForRevokeAll({
        actorStaffUserId: ACTOR_ID,
        actorSessionId: ACTOR_SESSION,
        targetStaffUserId: ACTOR_ID,
        includeCurrentSession: false,
      }),
      ACTOR_SESSION,
    );
  });

  it("revokes the caller session only when includeCurrentSession is explicit", () => {
    assert.equal(
      currentSessionIdForRevokeAll({
        actorStaffUserId: ACTOR_ID,
        actorSessionId: ACTOR_SESSION,
        targetStaffUserId: ACTOR_ID,
        includeCurrentSession: true,
      }),
      null,
    );
  });

  it("never preserves a target session when the actor is another user", () => {
    assert.equal(
      currentSessionIdForRevokeAll({
        actorStaffUserId: ACTOR_ID,
        actorSessionId: FORGED_SESSION,
        targetStaffUserId: TARGET_ID,
        includeCurrentSession: false,
      }),
      null,
    );
    assert.equal(
      currentSessionIdForRevokeAll({
        actorStaffUserId: ACTOR_ID,
        actorSessionId: FORGED_SESSION,
        targetStaffUserId: TARGET_ID,
        includeCurrentSession: true,
      }),
      null,
    );
  });
});
