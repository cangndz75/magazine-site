import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAPABILITY, hasCapability, STAFF_ROLE } from "@magazine/domain";
import { requireEditorCapability } from "./capability-check";
import { EDITOR_API_ERROR, EditorHttpError } from "./http";

describe("editor content capability mapping", () => {
  it("uses production hasCapability: AUTHOR can edit but not review or publish", () => {
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.CONTENT_EDIT), true);
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.CONTENT_REVIEW), false);
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.CONTENT_PUBLISH), false);
  });

  it("rejects missing capability with 403 via production helper", () => {
    try {
      requireEditorCapability(
        { roles: [STAFF_ROLE.AUTHOR] },
        CAPABILITY.CONTENT_PUBLISH,
      );
      assert.fail("expected throw");
    } catch (error) {
      assert.equal(error instanceof EditorHttpError, true);
      if (error instanceof EditorHttpError) {
        assert.equal(error.status, 403);
        assert.equal(error.code, EDITOR_API_ERROR.FORBIDDEN);
      }
    }
  });

  it("does not treat CONTENT_REVIEW as publication permission", () => {
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.CONTENT_REVIEW), false);
    assert.equal(hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.CONTENT_PUBLISH), true);
  });
});
