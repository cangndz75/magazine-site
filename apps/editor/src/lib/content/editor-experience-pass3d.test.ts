import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

function componentSource(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../../components/${relativePath}`, import.meta.url)),
    "utf8",
  );
}

describe("editor experience pass 3d contracts", () => {
  it("keeps clear filters scoped to explicit newsroom filters only", () => {
    const source = componentSource("newsroom-desk.tsx");

    assert.match(source, /const params = new URLSearchParams\(\)/);
    assert.match(source, /filters\.sort !== NEWSROOM_SORT\.UPDATED_DESC/);
    assert.equal(
      source.includes("applyFilterUpdates(searchParams, { view: filters.view })"),
      false,
    );
  });

  it("resets entity suggestion stats at the loading boundary and ignores stale responses", () => {
    const source = componentSource("article-entity-link-assistant.tsx");

    assert.match(
      source,
      /onSuggestionStatsRef\.current\?\.\(\{ pendingCount: 0, ambiguousCount: 0 \}\)/,
    );
    assert.match(source, /let active = true/);
    assert.match(source, /if \(!active\)/);
    const fetchEffectDeps = source.slice(
      source.indexOf("    relatedKey,"),
      source.indexOf("    relatedEntityIds,"),
    );
    assert.equal(fetchEffectDeps.includes("onSuggestionSnapshot"), false);
    assert.equal(fetchEffectDeps.includes("onSuggestionStats"), false);
  });

  it("exposes one canonical legal section anchor", () => {
    const source = componentSource("article-editor.tsx");
    const matches = source.match(/id="editor-section-legal"/g) ?? [];

    assert.equal(matches.length, 1);
  });

  it("shows a non-xl review inspector with close and Escape dismissal", () => {
    const source = componentSource("review-queue-list.tsx");

    assert.match(source, /variant="inline"/);
    assert.match(source, /variant="rail"/);
    assert.match(source, /xl:hidden/);
    assert.match(source, /xl:block/);
    assert.match(source, /event\.key === "Escape"/);
    assert.match(source, /onClose=\{\(\) => setSelectedVersionId\(null\)\}/);
    assert.equal(source.includes("after:absolute after:inset-0"), false);
    assert.match(source, /onClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  });

  it("keeps newsroom mobile selection and editor navigation as sibling controls", () => {
    const source = componentSource("newsroom-table.tsx");
    const cardRow = source.slice(source.indexOf("function NewsroomCardRow"));
    const buttonStart = cardRow.indexOf("<button");
    const buttonEnd = cardRow.indexOf("</button>");
    const buttonSource = cardRow.slice(buttonStart, buttonEnd);

    assert.equal(buttonSource.includes("<Link"), false);
    assert.equal(cardRow.includes("</button>"), true);
    assert.match(cardRow.slice(buttonEnd), /<Link\s+href=\{href\}/);
  });
});
