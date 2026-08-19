import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isEditorSessionExemptPath } from "./proxy-paths";

describe("editor session proxy path exemptions", () => {
  it("lets machine internal routes through without a staff session", () => {
    assert.equal(
      isEditorSessionExemptPath("/api/internal/public-cache-outbox/process"),
      true,
    );
    assert.equal(
      isEditorSessionExemptPath("/api/internal/scheduled-publish"),
      true,
    );
  });

  it("keeps staff content APIs behind the session proxy", () => {
    assert.equal(
      isEditorSessionExemptPath(
        "/api/content/1a3ccd0d-594e-41cc-9350-9a6085699090/publish",
      ),
      false,
    );
    assert.equal(isEditorSessionExemptPath("/content"), false);
    assert.equal(isEditorSessionExemptPath("/api/internal"), false);
    assert.equal(isEditorSessionExemptPath("/api/internals"), false);
    assert.equal(isEditorSessionExemptPath("/api/media/upload"), false);
  });

  it("preserves existing public login and health exemptions", () => {
    assert.equal(isEditorSessionExemptPath("/login"), true);
    assert.equal(isEditorSessionExemptPath("/api/health"), true);
    assert.equal(isEditorSessionExemptPath("/api/auth/login"), true);
  });
});
