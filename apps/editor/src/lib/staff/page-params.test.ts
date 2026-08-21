import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STAFF_ROLE, STAFF_SCOPE_MODE, STAFF_STATUS } from "@magazine/domain";
import {
  parseStaffPageSearchParams,
  staffListQueryString,
} from "./page-params";

describe("staff page params", () => {
  it("parses list filters from search params", () => {
    const filters = parseStaffPageSearchParams({
      q: "  editor ",
      status: STAFF_STATUS.ACTIVE,
      role: STAFF_ROLE.EDITOR,
      scopeMode: STAFF_SCOPE_MODE.SELECTED,
      limit: "10",
    });

    assert.equal(filters.search, "editor");
    assert.equal(filters.status, STAFF_STATUS.ACTIVE);
    assert.equal(filters.role, STAFF_ROLE.EDITOR);
    assert.equal(filters.scopeMode, STAFF_SCOPE_MODE.SELECTED);
    assert.equal(filters.limit, 10);
  });

  it("ignores invalid filter values", () => {
    const filters = parseStaffPageSearchParams({
      status: "BANNED",
      role: "ROOT",
      scopeMode: "CUSTOM",
    });
    assert.equal(filters.status, undefined);
    assert.equal(filters.role, undefined);
    assert.equal(filters.scopeMode, undefined);
  });

  it("serializes filters to query string", () => {
    const qs = staffListQueryString({
      limit: 20,
      cursor: null,
      search: "ali",
      status: STAFF_STATUS.DISABLED,
      role: undefined,
      scopeMode: undefined,
    });
    assert.match(qs, /q=ali/);
    assert.match(qs, /status=DISABLED/);
    assert.equal(qs.includes("cursor="), false);
  });
});
