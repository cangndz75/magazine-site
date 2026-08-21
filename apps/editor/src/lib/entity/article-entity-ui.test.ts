import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import {
  addEntity,
  reorderEntity,
  setEntityRole,
  ARTICLE_EDITOR_EMPTY_RELATIONS,
} from "@/lib/content/article-relation-state";
import { ENTITY_ROLE, ENTITY_STATUS } from "@magazine/domain";

const componentsRoot = path.join(import.meta.dirname, "..", "..", "components");

describe("article entity relations UI boundary", () => {
  it("labels entity roles in Turkish", () => {
    const source = readFileSync(
      path.join(componentsRoot, "article-entity-relations-section.tsx"),
      "utf8",
    );
    assert.match(source, /Ana Konu/);
    assert.match(source, /Bahsedilen/);
    assert.match(source, /Bu varlık arşivlenmiş/);
  });

  it("wires the linking assistant without auto-inserting body links", () => {
    const source = readFileSync(
      path.join(componentsRoot, "article-metadata-editor.tsx"),
      "utf8",
    );
    assert.match(source, /ArticleEntityLinkAssistant/);
    assert.match(source, /ENTITY_ROLE.MENTIONED/);
    assert.doesNotMatch(source, /editorDocumentToBody/);
  });
});

describe("article entity relation state", () => {
  it("supports role changes and reordering", () => {
    let relations = addEntity(ARTICLE_EDITOR_EMPTY_RELATIONS, {
      id: "11111111-1111-4111-8111-111111111111",
      name: "A",
      kind: "PERSON",
      status: ENTITY_STATUS.ACTIVE,
    });
    relations = addEntity(relations, {
      id: "22222222-2222-4222-8222-222222222222",
      name: "B",
      kind: "PERSON",
      status: ENTITY_STATUS.ACTIVE,
    });
    relations = setEntityRole(
      relations,
      "22222222-2222-4222-8222-222222222222",
      ENTITY_ROLE.MENTIONED,
    );
    relations = reorderEntity(
      relations,
      "22222222-2222-4222-8222-222222222222",
      "up",
    );
    assert.equal(relations.entities[0]?.id, "22222222-2222-4222-8222-222222222222");
    assert.equal(relations.entities[1]?.role, ENTITY_ROLE.SUBJECT);
  });
});
