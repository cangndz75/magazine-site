import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ENTITY_ERROR } from "@magazine/domain";
import { presentEntityAdminFailure } from "./presentation";

describe("presentEntityAdminFailure", () => {
  it("marks entity write conflicts", () => {
    const result = presentEntityAdminFailure(ENTITY_ERROR.ENTITY_WRITE_CONFLICT);
    assert.equal(result.isConflict, true);
    assert.match(result.message, /başka bir kullanıcı/i);
  });

  it("maps slug conflicts to Turkish product copy", () => {
    const result = presentEntityAdminFailure(ENTITY_ERROR.SLUG_CONFLICT);
    assert.equal(result.isConflict, false);
    assert.match(result.message, /URL/i);
  });
});
