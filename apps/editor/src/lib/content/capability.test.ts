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

  it("gives ANALYTICS_READ to Super Admin and Editor, not Author", () => {
    assert.equal(
      hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.ANALYTICS_READ),
      true,
    );
    assert.equal(hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.ANALYTICS_READ), true);
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.ANALYTICS_READ), false);
    try {
      requireEditorCapability(
        { roles: [STAFF_ROLE.AUTHOR] },
        CAPABILITY.ANALYTICS_READ,
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

  it("gives STAFF_MANAGE only to Super Admin", () => {
    assert.equal(
      hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.STAFF_MANAGE),
      true,
    );
    assert.equal(hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.STAFF_MANAGE), false);
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.STAFF_MANAGE), false);
    try {
      requireEditorCapability(
        { roles: [STAFF_ROLE.EDITOR] },
        CAPABILITY.STAFF_MANAGE,
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
});
