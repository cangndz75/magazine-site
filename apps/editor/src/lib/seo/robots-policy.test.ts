import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEditorRobotsDocument } from "@magazine/domain";

describe("editor robots policy", () => {
  it("disallows all crawlers and does not advertise a sitemap", () => {
    const document = buildEditorRobotsDocument();
    assert.deepEqual(document.rules, { userAgent: "*", disallow: "/" });
    assert.equal(document.sitemap, undefined);
  });
});
