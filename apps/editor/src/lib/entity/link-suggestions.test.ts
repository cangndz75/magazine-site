import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { ENTITY_ROLE, ENTITY_STATUS } from "@magazine/domain";
import {
  addEntity,
  ARTICLE_EDITOR_EMPTY_RELATIONS,
} from "@/lib/content/article-relation-state";
import {
  ENTITY_LINK_ASSISTANT_COPY,
  parseEntityLinkSuggestionRequest,
  suggestionAddAriaLabel,
} from "./link-suggestions";

const componentsRoot = path.join(import.meta.dirname, "..", "..", "components");

describe("entity link suggestion request", () => {
  it("accepts bounded structured body and related ids", () => {
    const parsed = parseEntityLinkSuggestionRequest({
      title: "Hande Erçel",
      body: { blocks: [{ type: "paragraph", text: "alias metin" }] },
      relatedEntityIds: ["11111111-1111-4111-8111-111111111111"],
    });
    assert.equal(parsed.title, "Hande Erçel");
    assert.deepEqual(parsed.relatedEntityIds, [
      "11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("rejects a non-JSON body payload", () => {
    assert.throws(() => parseEntityLinkSuggestionRequest({ body: "raw html" }));
  });
});

describe("entity link assistant UI contract", () => {
  it("keeps suggestion copy and labelled actions", () => {
    const source = readFileSync(
      path.join(componentsRoot, "article-entity-link-assistant.tsx"),
      "utf8",
    );
    assert.match(source, /ENTITY_LINK_ASSISTANT_COPY.TITLE/);
    assert.match(source, /ENTITY_LINK_ASSISTANT_COPY.ALREADY_RELATED/);
    assert.match(source, /ENTITY_LINK_ASSISTANT_COPY.ADD/);
    assert.match(source, /aria-label/);
    assert.match(source, /role="status"/);
    assert.equal(suggestionAddAriaLabel("Hande Erçel").includes("Hande Erçel"), true);
    assert.equal(ENTITY_LINK_ASSISTANT_COPY.TITLE, "İç Bağlantı Önerileri");
    assert.equal(ENTITY_LINK_ASSISTANT_COPY.AMBIGUOUS.includes("birden fazla"), true);
  });

  it("does not rewrite the article body when attaching a suggestion", () => {
    const relations = addEntity(ARTICLE_EDITOR_EMPTY_RELATIONS, {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Hande Erçel",
      kind: "PERSON",
      status: ENTITY_STATUS.ACTIVE,
      role: ENTITY_ROLE.MENTIONED,
    });
    assert.equal(relations.entities[0]?.role, ENTITY_ROLE.MENTIONED);
  });
});
