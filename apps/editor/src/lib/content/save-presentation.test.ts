import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSuccessfulSaveResponse,
  presentSaveFailure,
} from "./save-presentation";

describe("save presentation / concurrency", () => {
  it("does not treat a stale-write conflict as success", () => {
    const presented = presentSaveFailure("CONTENT_WRITE_CONFLICT");
    assert.equal(presented.kind, "conflict");
    assert.equal(presented.message.includes("güncellendi"), true);
    assert.equal(
      isSuccessfulSaveResponse({ okHttp: false, okBody: false, hasData: false }),
      false,
    );
    assert.equal(
      isSuccessfulSaveResponse({ okHttp: true, okBody: false, hasData: false }),
      false,
    );
  });

  it("requires http ok, body ok, and data before success", () => {
    assert.equal(
      isSuccessfulSaveResponse({ okHttp: true, okBody: true, hasData: true }),
      true,
    );
    assert.equal(
      isSuccessfulSaveResponse({ okHttp: true, okBody: true, hasData: false }),
      false,
    );
  });

  it("maps other failures to a generic error without a saved state", () => {
    const presented = presentSaveFailure("INTERNAL_ERROR", "ignored-internal");
    assert.equal(presented.kind, "error");
    assert.notEqual(presented.kind, "conflict");
  });

  it("keeps conflict distinct from relation validation failures", () => {
    const conflict = presentSaveFailure("CONTENT_WRITE_CONFLICT");
    const scope = presentSaveFailure("CATEGORY_OUT_OF_SCOPE");
    const missing = presentSaveFailure("RELATION_NOT_FOUND");
    assert.equal(conflict.kind, "conflict");
    assert.equal(scope.kind, "error");
    assert.equal(missing.kind, "error");
    assert.equal(scope.message.includes("yetki"), true);
    assert.equal(isSuccessfulSaveResponse({
      okHttp: false,
      okBody: false,
      hasData: false,
    }), false);
  });
});
