import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ARTICLE_EDITOR_EMPTY_FIELDS } from "./article-editor-state";
import { ARTICLE_EDITOR_EMPTY_RELATIONS } from "./article-relation-state";
import {
  createArticleEditorDraftSnapshot,
  isArticleEditorDirty,
} from "./article-editor-session";

const VERSION = {
  fields: {
    ...ARTICLE_EDITOR_EMPTY_FIELDS,
    title: "Kapak denemesi",
    subtitle: "  ",
    excerpt: "Spot",
  },
  body: {
    blocks: [{ type: "paragraph", text: "Merhaba" }],
  },
  relations: {
    ...ARTICLE_EDITOR_EMPTY_RELATIONS,
    categories: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Magazin",
        slug: "magazin",
        parentName: null,
        isPrimary: true,
      },
    ],
  },
};

describe("article editor initial snapshot", () => {
  it("is clean when current and baseline share the canonical snapshot", () => {
    const snapshot = createArticleEditorDraftSnapshot(VERSION);
    assert.equal(snapshot.fields?.subtitle, null);
    assert.equal(
      isArticleEditorDirty({
        fields: snapshot.fields,
        baseline: snapshot.fields,
        relations: snapshot.relations,
        baselineRelations: snapshot.relations,
        body: snapshot.body,
        baselineBody: snapshot.body,
      }),
      false,
    );
  });

  it("stays clean across independently created snapshots from the same server payload", () => {
    const left = createArticleEditorDraftSnapshot(VERSION);
    const right = createArticleEditorDraftSnapshot(VERSION);
    assert.equal(
      isArticleEditorDirty({
        fields: left.fields,
        baseline: right.fields,
        relations: left.relations,
        baselineRelations: right.relations,
        body: left.body,
        baselineBody: right.body,
      }),
      false,
    );
  });

  it("does not treat an empty placeholder body as dirty", () => {
    const snapshot = createArticleEditorDraftSnapshot({
      ...VERSION,
      body: { blocks: [] },
    });
    assert.equal(
      isArticleEditorDirty({
        fields: snapshot.fields,
        baseline: snapshot.fields,
        relations: snapshot.relations,
        baselineRelations: snapshot.relations,
        body: snapshot.body,
        baselineBody: snapshot.body,
      }),
      false,
    );
  });

  it("marks a title edit dirty and the exact revert clean", () => {
    const snapshot = createArticleEditorDraftSnapshot(VERSION);
    const edited = { ...snapshot.fields!, title: "Yeni başlık" };
    assert.equal(
      isArticleEditorDirty({
        fields: edited,
        baseline: snapshot.fields,
        relations: snapshot.relations,
        baselineRelations: snapshot.relations,
        body: snapshot.body,
        baselineBody: snapshot.body,
      }),
      true,
    );
    assert.equal(
      isArticleEditorDirty({
        fields: { ...edited, title: "Kapak denemesi" },
        baseline: snapshot.fields,
        relations: snapshot.relations,
        baselineRelations: snapshot.relations,
        body: snapshot.body,
        baselineBody: snapshot.body,
      }),
      false,
    );
  });
});
