import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MEDIA_LIBRARY_QUERY,
  parseMediaLibraryPageSearchParams,
  parseMediaLibraryQuery,
  parseMediaLibrarySelectedId,
} from "./params";

describe("parseMediaLibraryQuery", () => {
  it("rejects invalid sort and media type", () => {
    const badSort = parseMediaLibraryQuery(new URLSearchParams("sort=invalid"));
    assert.ok("error" in badSort);

    const badType = parseMediaLibraryQuery(new URLSearchParams("type=invalid"));
    assert.ok("error" in badType);
  });

  it("parses bounded search and filters", () => {
    const params = new URLSearchParams({
      q: "  photographer  ",
      type: "IMAGE",
      rightsStatus: "INCOMPLETE",
      missingCredit: "1",
      used: "true",
      sort: "filename_asc",
      pageSize: "12",
    });
    const parsed = parseMediaLibraryQuery(params);
    assert.ok(!("error" in parsed));
    if ("error" in parsed) {
      return;
    }
    assert.equal(parsed.q, "photographer");
    assert.equal(parsed.type, "IMAGE");
    assert.equal(parsed.rightsStatus, "INCOMPLETE");
    assert.equal(parsed.missingCredit, true);
    assert.equal(parsed.used, true);
    assert.equal(parsed.sort, "filename_asc");
    assert.equal(parsed.pageSize, 12);
  });

  it("parses server page search params and selected id", () => {
    const parsed = parseMediaLibraryPageSearchParams({
      q: "portrait",
      type: "IMAGE",
      sort: "filename_asc",
      selected: "media-id-1",
    });
    assert.ok(!("error" in parsed));
    if ("error" in parsed) {
      return;
    }
    assert.equal(parsed.q, "portrait");
    assert.equal(parsed.type, "IMAGE");
    assert.equal(parsed.sort, "filename_asc");
    assert.equal(parseMediaLibrarySelectedId({ selected: "media-id-1" }), "media-id-1");
    assert.equal(parseMediaLibrarySelectedId({}), null);
  });

  it("falls back to defaults for invalid page params", () => {
    const parsed = parseMediaLibraryPageSearchParams({ sort: "invalid" });
    assert.ok("error" in parsed);
    assert.equal(DEFAULT_MEDIA_LIBRARY_QUERY.sort, "created_desc");
  });
});
