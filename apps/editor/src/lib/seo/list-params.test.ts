import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSeoInspectionSearchParams } from "./list-params";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";

describe("SEO inspection API query parsing", () => {
  it("accepts the bounded filter contract", () => {
    const parsed = parseSeoInspectionSearchParams(
      new URL(
        "https://editor.example/api/seo/content?q=haber&findingFilter=HEALTHY&indexable=1&missingSeoTitle=1&cursor=",
      ),
    );
    assert.equal(parsed.search, "haber");
    assert.equal(parsed.findingFilter, "HEALTHY");
    assert.equal(parsed.indexable, true);
    assert.equal(parsed.missingSeoTitle, true);
    assert.equal(parsed.cursor, null);
  });

  it("rejects invalid filter tokens", () => {
    assert.throws(
      () =>
        parseSeoInspectionSearchParams(
          new URL("https://editor.example/api/seo/content?findingFilter=BROKEN"),
        ),
      (error: unknown) =>
        error instanceof EditorHttpError &&
        error.status === 400 &&
        error.code === EDITOR_API_ERROR.INVALID_REQUEST,
    );
  });
});
