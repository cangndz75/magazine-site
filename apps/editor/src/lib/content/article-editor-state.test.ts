import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ARTICLE_EDITOR_EMPTY_FIELDS,
  articleEditorFieldsEqual,
  normalizeArticleEditorFields,
  validateArticleEditorFields,
  type ArticleEditorFields,
} from "./article-editor-state";

function fields(
  overrides: Partial<ArticleEditorFields> = {},
): ArticleEditorFields {
  return {
    ...ARTICLE_EDITOR_EMPTY_FIELDS,
    title: "Başlık",
    excerpt: "Spot",
    ...overrides,
  };
}

describe("article editor dirty state", () => {
  it("treats initial fields as clean", () => {
    assert.equal(articleEditorFieldsEqual(fields(), fields()), true);
  });

  it("marks a title change dirty and a revert clean", () => {
    const initial = fields({ title: "Başlık" });
    const changed = fields({ title: "Yeni başlık" });
    assert.equal(articleEditorFieldsEqual(initial, changed), false);
    assert.equal(articleEditorFieldsEqual(initial, fields({ title: "Başlık" })), true);
  });

  it("tracks boolean changes and reverts", () => {
    const initial = fields({ syndicated: false });
    const changed = fields({ syndicated: true });
    assert.equal(articleEditorFieldsEqual(initial, changed), false);
    assert.equal(articleEditorFieldsEqual(initial, fields({ syndicated: false })), true);
  });

  it("uses domain null semantics for optional text", () => {
    assert.equal(
      articleEditorFieldsEqual(
        fields({ subtitle: null }),
        fields({ subtitle: "   " }),
      ),
      true,
    );
    assert.equal(normalizeArticleEditorFields(fields({ excerpt: "" })).excerpt, null);
  });
});

describe("article editor validation", () => {
  it("requires title", () => {
    const result = validateArticleEditorFields(fields({ title: "   " }));
    assert.equal(result.ok, false);
    assert.equal(result.errors.title, "Başlık zorunlu.");
  });

  it("accepts http and https URLs", () => {
    assert.equal(
      validateArticleEditorFields(
        fields({
          canonicalUrl: "https://example.com/article",
          sourceUrl: "http://example.com/source",
        }),
      ).ok,
      true,
    );
  });

  it("rejects non-http URLs", () => {
    const result = validateArticleEditorFields(
      fields({ sourceUrl: "javascript:alert(1)" }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.errors.sourceUrl, "URL http veya https olmalı.");
  });

  it("keeps read-only metadata outside dirty comparison", () => {
    const before = fields({ title: "A" });
    const after = fields({ title: "A" });
    assert.equal(articleEditorFieldsEqual(before, after), true);
  });
});
