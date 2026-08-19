import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_JSON_MAX_BYTES, MEDIA_RIGHTS_ERROR, MEDIA_UPLOAD_ERROR, MediaRightsError, MediaUploadError, PUBLISHING_ERROR, PublishingError } from "@magazine/domain";
import {
  EDITOR_API_ERROR,
  mapEditorError,
  readEditorJsonBody,
} from "./http";

describe("editor content error mapper", () => {
  it("maps anonymous auth failure to 401", async () => {
    const { EditorHttpError } = await import("./http");
    const response = mapEditorError(
      new EditorHttpError(401, EDITOR_API_ERROR.UNAUTHENTICATED, "Authentication required."),
    );
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.ok, false);
    assert.equal(body.error.code, "UNAUTHENTICATED");
  });

  it("maps PublishingError codes without leaking internals", async () => {
    const response = mapEditorError(
      new PublishingError(PUBLISHING_ERROR.DRAFT_ALREADY_EXISTS, "SQL STATE 23505"),
    );
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.error.code, "DRAFT_ALREADY_EXISTS");
    assert.equal(JSON.stringify(body).includes("23505"), false);
    assert.equal(JSON.stringify(body).includes("SQL"), false);
  });

  it("does not leak infrastructure stacks or SQL", async () => {
    const response = mapEditorError(
      new Error('relation "content_items" does not exist\n    at Query.run (pg.js:1:1)'),
    );
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.error.code, "INTERNAL_ERROR");
    assert.equal(JSON.stringify(body).includes("content_items"), false);
    assert.equal(JSON.stringify(body).includes("pg.js"), false);
    assert.equal(JSON.stringify(body).includes("DATABASE_URL"), false);
  });

  it("maps write conflicts to 409", async () => {
    const response = mapEditorError(
      new PublishingError(PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT),
    );
    assert.equal(response.status, 409);
  });

  it("maps invalid hero media type without leaking internals", async () => {
    const response = mapEditorError(
      new PublishingError(PUBLISHING_ERROR.INVALID_HERO_MEDIA, "video/mp4 decoder stack"),
    );
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, "INVALID_HERO_MEDIA");
    assert.equal(JSON.stringify(body).includes("video/mp4"), false);
    assert.equal(JSON.stringify(body).includes("decoder"), false);
  });

  it("maps invalid review notes to 400 without leaking internals", async () => {
    const response = mapEditorError(
      new PublishingError(PUBLISHING_ERROR.INVALID_REVIEW_NOTE, "CHECK content_review_events_note_bounds"),
    );
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, "INVALID_REVIEW_NOTE");
    assert.equal(JSON.stringify(body).includes("content_review_events"), false);
  });

  it("maps corrupt stored bodies to 422 without leaking internals", async () => {
    const response = mapEditorError(
      new PublishingError(
        PUBLISHING_ERROR.CONTENT_BODY_CORRUPT,
        'unexpected token at body.blocks[0]\n    at Query.run (pg.js:1:1)',
      ),
    );
    assert.equal(response.status, 422);
    const body = await response.json();
    assert.equal(body.error.code, "CONTENT_BODY_CORRUPT");
    assert.equal(JSON.stringify(body).includes("unexpected token"), false);
    assert.equal(JSON.stringify(body).includes("pg.js"), false);
  });

  it("maps MediaRightsError without leaking internals", async () => {
    const response = mapEditorError(
      new MediaRightsError(MEDIA_RIGHTS_ERROR.INVALID_RIGHTS, "CHECK media_license_window_valid"),
    );
    assert.equal(response.status, 400);
    const rightsBody = await response.json();
    assert.equal(rightsBody.ok, false);
    assert.equal(rightsBody.error.code, "INVALID_RIGHTS");
    assert.equal(JSON.stringify(rightsBody).includes("media_license_window"), false);
  });

  it("maps MediaUploadError without leaking internals", async () => {
    const response = mapEditorError(
      new MediaUploadError(MEDIA_UPLOAD_ERROR.INVALID_IMAGE, "VipsJpeg: bad file"),
    );
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, "INVALID_IMAGE");
    assert.equal(JSON.stringify(body).includes("VipsJpeg"), false);
  });
});

describe("editor JSON body limit", () => {
  it("rejects bodies larger than 1 MiB", async () => {
    const oversized = "a".repeat(EDITOR_JSON_MAX_BYTES + 1);
    await assert.rejects(
      () =>
        readEditorJsonBody(
          new Request("https://editor.example/api/content", {
            method: "POST",
            body: oversized,
          }),
        ),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === EDITOR_API_ERROR.REQUEST_TOO_LARGE,
    );
  });

  it("parses a bounded JSON object", async () => {
    const body = await readEditorJsonBody(
      new Request("https://editor.example/api/content", {
        method: "POST",
        body: JSON.stringify({ title: "Hello" }),
      }),
    );
    assert.deepEqual(body, { title: "Hello" });
  });
});
