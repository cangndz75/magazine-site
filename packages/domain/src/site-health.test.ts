import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_ROLE } from "./staff-role";
import {
  SITE_HEALTH_STATUS,
  assertSafeSiteHealthDto,
  authorizeSiteHealthRead,
  deriveSiteHealthOverallStatus,
} from "./site-health";

describe("site health domain contract", () => {
  it("derives overall status by unavailable, attention, degraded, healthy precedence", () => {
    assert.equal(
      deriveSiteHealthOverallStatus([
        SITE_HEALTH_STATUS.HEALTHY,
        SITE_HEALTH_STATUS.DEGRADED,
      ]),
      SITE_HEALTH_STATUS.DEGRADED,
    );
    assert.equal(
      deriveSiteHealthOverallStatus([
        SITE_HEALTH_STATUS.ATTENTION,
        SITE_HEALTH_STATUS.DEGRADED,
      ]),
      SITE_HEALTH_STATUS.ATTENTION,
    );
    assert.equal(
      deriveSiteHealthOverallStatus([
        SITE_HEALTH_STATUS.ATTENTION,
        SITE_HEALTH_STATUS.UNAVAILABLE,
      ]),
      SITE_HEALTH_STATUS.UNAVAILABLE,
    );
  });

  it("keeps Site Health behind the existing Super Admin capability", () => {
    assert.deepEqual(authorizeSiteHealthRead({ roles: [STAFF_ROLE.SUPER_ADMIN] }), {
      ok: true,
    });
    assert.deepEqual(authorizeSiteHealthRead({ roles: [STAFF_ROLE.EDITOR] }), {
      ok: false,
      code: "FORBIDDEN",
    });
    assert.deepEqual(authorizeSiteHealthRead({ roles: [STAFF_ROLE.AUTHOR] }), {
      ok: false,
      code: "FORBIDDEN",
    });
  });

  it("rejects sensitive keys anywhere in the DTO boundary", () => {
    assert.doesNotThrow(() =>
      assertSafeSiteHealthDto({
        database: { metrics: { available: true, queryTimestamp: null } },
      }),
    );
    assert.throws(
      () =>
        assertSafeSiteHealthDto({
          media: { metrics: { storageKey: "private/object.jpg" } },
        }),
      /forbidden key/i,
    );
  });
});
