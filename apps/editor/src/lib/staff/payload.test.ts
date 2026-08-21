import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STAFF_ADMIN_ERROR,
  STAFF_ROLE,
  STAFF_SCOPE_MODE,
  STAFF_STATUS,
  StaffAdminError,
} from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";
import {
  parseExpectedUpdatedAtBody,
  parseRevokeAllSessionsBody,
  parseStaffListQuery,
  parseStaffRolesBody,
  parseStaffScopeBody,
  parseStaffStatusBody,
  parseStaffUserId,
} from "./payload";

const TOKEN = "2026-08-20T08:00:00.000Z";
const STAFF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("staff administration payload", () => {
  it("parses list filters without trusting capability query params", () => {
    const query = parseStaffListQuery(
      new URL(
        `https://editor.example/api/staff?q=Ada&status=${STAFF_STATUS.ACTIVE}&role=${STAFF_ROLE.EDITOR}&scopeMode=${STAFF_SCOPE_MODE.SELECTED}&capabilities=STAFF_MANAGE`,
      ),
    );
    assert.equal(query.search, "Ada");
    assert.equal(query.status, STAFF_STATUS.ACTIVE);
    assert.equal(query.role, STAFF_ROLE.EDITOR);
    assert.equal(query.scopeMode, STAFF_SCOPE_MODE.SELECTED);
    assert.equal("capabilities" in query, false);
  });

  it("rejects malformed role, status, and scope filters", () => {
    assert.throws(
      () =>
        parseStaffListQuery(new URL("https://editor.example/api/staff?role=GOD")),
      (error: unknown) =>
        error instanceof StaffAdminError &&
        error.code === STAFF_ADMIN_ERROR.INVALID_ROLE,
    );
    assert.throws(
      () =>
        parseStaffListQuery(
          new URL("https://editor.example/api/staff?status=DELETED"),
        ),
      (error: unknown) =>
        error instanceof StaffAdminError &&
        error.code === STAFF_ADMIN_ERROR.INVALID_STATUS,
    );
    assert.throws(
      () =>
        parseStaffListQuery(
          new URL("https://editor.example/api/staff?scopeMode=GLOBAL"),
        ),
      (error: unknown) =>
        error instanceof StaffAdminError &&
        error.code === STAFF_ADMIN_ERROR.INVALID_SCOPE,
    );
  });

  it("requires a UUID staff path id", () => {
    assert.equal(parseStaffUserId(STAFF_ID), STAFF_ID);
    assert.throws(
      () => parseStaffUserId("not-a-uuid"),
      (error: unknown) =>
        error instanceof EditorHttpError &&
        error.code === EDITOR_API_ERROR.INVALID_REQUEST,
    );
  });

  it("parses suspend/reactivate bodies with expectedUpdatedAt", () => {
    const parsed = parseStaffStatusBody({
      status: STAFF_STATUS.DISABLED,
      expectedUpdatedAt: TOKEN,
      currentSessionId: "forged",
    });
    assert.equal(parsed.status, STAFF_STATUS.DISABLED);
    assert.equal(parsed.expectedUpdatedAt, TOKEN);
    assert.equal("currentSessionId" in parsed, false);
  });

  it("rejects malformed roles instead of trusting request bodies", () => {
    assert.throws(
      () =>
        parseStaffRolesBody({
          roles: ["GOD"],
          expectedUpdatedAt: TOKEN,
        }),
      (error: unknown) =>
        error instanceof StaffAdminError &&
        error.code === STAFF_ADMIN_ERROR.INVALID_ROLE,
    );
    const parsed = parseStaffRolesBody({
      roles: [STAFF_ROLE.EDITOR],
      expectedUpdatedAt: TOKEN,
      capabilities: ["STAFF_MANAGE"],
    });
    assert.deepEqual(parsed.roles, [STAFF_ROLE.EDITOR]);
    assert.equal("capabilities" in parsed, false);
  });

  it("rejects non-UUID category IDs before the database write", () => {
    assert.throws(
      () =>
        parseStaffScopeBody({
          scopeMode: STAFF_SCOPE_MODE.SELECTED,
          scopedCategoryIds: ["not-a-category"],
          expectedUpdatedAt: TOKEN,
        }),
      (error: unknown) =>
        error instanceof StaffAdminError &&
        error.code === STAFF_ADMIN_ERROR.INVALID_SCOPE,
    );
  });

  it("keeps scoped category IDs as strings for server validation", () => {
    const parsed = parseStaffScopeBody({
      scopeMode: STAFF_SCOPE_MODE.SELECTED,
      scopedCategoryIds: [STAFF_ID],
      expectedUpdatedAt: TOKEN,
      capabilities: ["STAFF_MANAGE"],
    });
    assert.equal(parsed.scopeMode, STAFF_SCOPE_MODE.SELECTED);
    assert.deepEqual(parsed.scopedCategoryIds, [STAFF_ID]);
    assert.equal("capabilities" in parsed, false);
  });

  it("requires expectedUpdatedAt for password-reset and MFA disable", () => {
    assert.equal(
      parseExpectedUpdatedAtBody({ expectedUpdatedAt: TOKEN }).expectedUpdatedAt,
      TOKEN,
    );
    assert.throws(
      () => parseExpectedUpdatedAtBody({}),
      (error: unknown) =>
        error instanceof EditorHttpError &&
        error.code === EDITOR_API_ERROR.INVALID_REQUEST,
    );
  });

  it("ignores a forged currentSessionId on revoke-all", () => {
    const parsed = parseRevokeAllSessionsBody({
      includeCurrentSession: false,
      currentSessionId: "44444444-4444-4444-8444-444444444444",
    });
    assert.equal(parsed.includeCurrentSession, false);
    assert.equal("currentSessionId" in parsed, false);
  });
});
