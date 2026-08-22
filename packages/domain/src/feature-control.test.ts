import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_ROLE } from "./staff-role";
import {
  FEATURE_CONTROL_ERROR,
  FEATURE_CONTROL_TYPE,
  FEATURE_FLAG_KEY,
  FeatureControlError,
  KILL_SWITCH_KEY,
  authorizeFeatureControlManage,
  decideFeatureControlUpdate,
  featureControlAuditOmitsSecrets,
  featureIsEnabled,
  getFeatureControlDefinition,
  isFeatureControlKey,
  killSwitchIsActive,
  resolveFeatureControl,
} from "./feature-control";

describe("feature controls domain contract", () => {
  it("accepts only known runtime control keys", () => {
    assert.equal(isFeatureControlKey(FEATURE_FLAG_KEY.PUBLIC_SEARCH), true);
    assert.equal(isFeatureControlKey(KILL_SWITCH_KEY.PUBLIC_VIDEO), true);
    assert.equal(isFeatureControlKey("PUBLIC_SEARCH;DROP TABLE content_items"), false);
    assert.throws(
      () => getFeatureControlDefinition("UNKNOWN"),
      (error) =>
        error instanceof FeatureControlError &&
        error.code === FEATURE_CONTROL_ERROR.UNKNOWN_KEY,
    );
  });

  it("preserves current production posture when persistence is unavailable", () => {
    const search = resolveFeatureControl(FEATURE_FLAG_KEY.PUBLIC_SEARCH, null);
    const analytics = resolveFeatureControl(KILL_SWITCH_KEY.ANALYTICS_INGESTION, null);

    assert.equal(search.source, "DEFAULT");
    assert.equal(featureIsEnabled(search), true);
    assert.equal(analytics.source, "DEFAULT");
    assert.equal(killSwitchIsActive(analytics), false);
  });

  it("keeps writes behind the Super Admin capability", () => {
    assert.deepEqual(
      authorizeFeatureControlManage({ roles: [STAFF_ROLE.SUPER_ADMIN] }),
      { ok: true },
    );
    assert.deepEqual(authorizeFeatureControlManage({ roles: [STAFF_ROLE.EDITOR] }), {
      ok: false,
      code: FEATURE_CONTROL_ERROR.FORBIDDEN,
    });
  });

  it("plans updates with optimistic concurrency and secret-free audit changes", () => {
    const current = {
      key: KILL_SWITCH_KEY.PUBLIC_VIDEO,
      type: FEATURE_CONTROL_TYPE.KILL_SWITCH,
      enabled: false,
      description: "Hides public hosted video projections when enabled.",
      updatedAt: new Date("2026-08-22T09:00:00.000Z"),
    };
    const plan = decideFeatureControlUpdate({
      current,
      expectedUpdatedAt: current.updatedAt,
      enabled: true,
      now: new Date("2026-08-22T09:00:00.000Z"),
    });

    assert.equal(plan.enabled, true);
    assert.equal(plan.updatedAt.toISOString(), "2026-08-22T09:00:00.001Z");
    assert.deepEqual(plan.changeSet.enabled, { from: false, to: true });
    assert.equal(featureControlAuditOmitsSecrets(plan.changeSet), true);

    assert.throws(
      () =>
        decideFeatureControlUpdate({
          current,
          expectedUpdatedAt: new Date("2026-08-22T08:59:59.000Z"),
          enabled: true,
          now: new Date("2026-08-22T09:00:00.000Z"),
        }),
      (error) =>
        error instanceof FeatureControlError &&
        error.code === FEATURE_CONTROL_ERROR.WRITE_CONFLICT,
    );
    assert.equal(featureControlAuditOmitsSecrets({ token: "secret" }), false);
  });
});
