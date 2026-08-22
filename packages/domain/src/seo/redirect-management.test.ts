import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_ROLE } from "../staff-role";
import {
  REDIRECT_ERROR,
  REDIRECT_RESOLUTION,
  REDIRECT_STATUS_CODE,
  RedirectError,
  authorizeRedirectManage,
  decideRedirectCreate,
  decideRedirectGraph,
  decideRedirectUpdate,
  normalizeRedirectPath,
  redirectAuditOmitsSecrets,
  resolveManualRedirect,
} from "./redirect-management";

function assertRedirectCode(error: unknown, code: string): boolean {
  assert.equal(error instanceof RedirectError, true, String(error));
  assert.equal((error as RedirectError).code, code);
  return true;
}

describe("redirect management domain contract", () => {
  it("normalizes internal paths and rejects open redirect inputs", () => {
    assert.deepEqual(normalizeRedirectPath("/eski-haber/", "source"), {
      ok: true,
      value: "/eski-haber",
    });
    assert.deepEqual(normalizeRedirectPath("/galeri//eski", "source"), {
      ok: true,
      value: "/galeri/eski",
    });

    for (const input of [
      "https://evil.example",
      "//evil.example",
      "/%2f%2fevil.example",
      "javascript:alert(1)",
      "data:text/html,evil",
      "/foo\\bar",
      "/foo?next=/bar",
      "/foo#frag",
      "/api/content",
      "/_next/static/app.js",
      "/login",
      "/admin/redirects",
      "/editor/redirects",
      "/arama",
      "/bad\u0000path",
    ]) {
      assert.equal(normalizeRedirectPath(input, "target").ok, false, input);
    }
  });

  it("plans permanent redirects with 308 resolution", () => {
    const plan = decideRedirectCreate({
      sourcePath: "/eski",
      targetPath: "/yeni",
      note: "  moved  ",
      now: new Date("2026-08-22T10:00:00.000Z"),
    });
    assert.equal(plan.status, "PERMANENT");
    assert.equal(plan.note, "moved");
    assert.deepEqual(
      resolveManualRedirect({
        targetPath: plan.targetPath,
        status: plan.status,
        enabled: true,
      }),
      {
        kind: REDIRECT_RESOLUTION.REDIRECT,
        targetPath: "/yeni",
        statusCode: REDIRECT_STATUS_CODE.PERMANENT,
      },
    );
    assert.deepEqual(resolveManualRedirect(null), { kind: REDIRECT_RESOLUTION.NONE });
  });

  it("rejects source equals target, loops, and chains", () => {
    assert.throws(
      () =>
        decideRedirectCreate({
          sourcePath: "/a",
          targetPath: "/a/",
          now: new Date(),
        }),
      (error) => assertRedirectCode(error, REDIRECT_ERROR.SOURCE_EQUALS_TARGET),
    );

    assert.deepEqual(
      decideRedirectGraph({
        candidate: { id: "2", sourcePath: "/a", targetPath: "/b", enabled: true },
        existingRules: [{ id: "1", sourcePath: "/b", targetPath: "/a", enabled: true }],
      }),
      { ok: false, code: REDIRECT_ERROR.REDIRECT_LOOP },
    );
    assert.deepEqual(
      decideRedirectGraph({
        candidate: { id: "2", sourcePath: "/a", targetPath: "/b", enabled: true },
        existingRules: [{ id: "1", sourcePath: "/b", targetPath: "/c", enabled: true }],
      }),
      { ok: false, code: REDIRECT_ERROR.REDIRECT_CHAIN },
    );
    assert.deepEqual(
      decideRedirectGraph({
        candidate: { id: "2", sourcePath: "/a", targetPath: "/b", enabled: true },
        existingRules: [{ id: "1", sourcePath: "/z", targetPath: "/a", enabled: true }],
      }),
      { ok: false, code: REDIRECT_ERROR.REDIRECT_CHAIN },
    );
  });

  it("authorizes writes and protects stale updates", () => {
    assert.deepEqual(authorizeRedirectManage({ roles: [STAFF_ROLE.SUPER_ADMIN] }), {
      ok: true,
    });
    assert.deepEqual(authorizeRedirectManage({ roles: [STAFF_ROLE.AUTHOR] }), {
      ok: false,
      code: REDIRECT_ERROR.FORBIDDEN,
    });

    const current = {
      id: "rule-1",
      sourcePath: "/a",
      targetPath: "/b",
      status: "PERMANENT" as const,
      enabled: true,
      note: null,
      createdAt: new Date("2026-08-22T09:00:00.000Z"),
      updatedAt: new Date("2026-08-22T09:00:00.000Z"),
    };
    const plan = decideRedirectUpdate({
      current,
      targetPath: "/c",
      expectedUpdatedAt: current.updatedAt,
      now: new Date("2026-08-22T09:00:00.000Z"),
    });
    assert.equal(plan.updatedAt.toISOString(), "2026-08-22T09:00:00.001Z");
    assert.deepEqual(plan.changeSet.targetPath, { from: "/b", to: "/c" });

    assert.throws(
      () =>
        decideRedirectUpdate({
          current,
          targetPath: "/d",
          expectedUpdatedAt: new Date("2026-08-22T08:00:00.000Z"),
          now: new Date(),
        }),
      (error) => assertRedirectCode(error, REDIRECT_ERROR.WRITE_CONFLICT),
    );
    assert.equal(redirectAuditOmitsSecrets({ token: "abc" }), false);
  });
});
