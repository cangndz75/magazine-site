import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.join(
  fileURLToPath(new URL("../../app/api", import.meta.url)),
);
const workspaceRoot = path.join(
  fileURLToPath(new URL("../../app/(workspace)", import.meta.url)),
);

function walkRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRouteFiles(full));
    } else if (entry.name === "route.ts" || entry.name === "page.tsx") {
      files.push(full);
    }
  }
  return files;
}

describe("SEO command center route contracts", () => {
  const seoApiFiles = walkRouteFiles(path.join(apiRoot, "seo"));

  it("keeps SEO HTTP handlers as CONTENT_READ list/detail reads", () => {
    assert.equal(seoApiFiles.length > 0, true);
    for (const file of seoApiFiles) {
      const source = readFileSync(file, "utf8");
      assert.equal(source.includes("CAPABILITY.CONTENT_READ"), true, file);
      assert.equal(source.includes("withEditorRead"), true, file);
      assert.equal(source.includes("withEditorWrite"), false, file);
      assert.equal(source.includes("updateContentSlug"), false, file);
      assert.equal(source.includes(".update("), false, file);
      assert.equal(source.includes("storageKey"), false, file);
      assert.equal(source.includes("internalNote"), false, file);
      assert.equal(source.includes("passwordHash"), false, file);
    }
  });

  it("authorizes the SEO workspace and inspector on the server", () => {
    const listPage = readFileSync(path.join(workspaceRoot, "seo", "page.tsx"), "utf8");
    const detailPage = readFileSync(
      path.join(workspaceRoot, "seo", "[contentItemId]", "page.tsx"),
      "utf8",
    );
    const layout = readFileSync(path.join(workspaceRoot, "layout.tsx"), "utf8");
    assert.equal(listPage.includes("requireCapability(CAPABILITY.CONTENT_READ)"), true);
    assert.equal(listPage.includes("listSeoInspections"), true);
    assert.equal(listPage.includes("summarizeSeoInspections"), true);
    assert.equal(listPage.includes("editorScopeFromSession"), true);
    assert.equal(detailPage.includes("getSeoInspectionDetail"), true);
    assert.equal(detailPage.includes("notFound()"), true);
    assert.match(layout, /canReadContent/);
    assert.match(layout, /href="\/seo"/);
    assert.match(layout, /SEO/);
  });

  it("does not add a second slug mutation path in SEO UI", () => {
    const inspector = readFileSync(
      path.join(
        fileURLToPath(new URL("../../components/seo-slug-history.tsx", import.meta.url)),
      ),
      "utf8",
    );
    const seoSection = readFileSync(
      path.join(
        fileURLToPath(new URL("../../components/article-seo-section.tsx", import.meta.url)),
      ),
      "utf8",
    );
    const articleEditor = readFileSync(
      path.join(
        fileURLToPath(new URL("../../components/article-editor.tsx", import.meta.url)),
      ),
      "utf8",
    );
    assert.equal(inspector.includes("updateContentSlug"), false);
    assert.equal(seoSection.includes("updateContentSlug"), false);
    assert.equal(seoSection.includes("id=\"article-robots\""), true);
    assert.equal(seoSection.includes("<select"), true);
    assert.equal(seoSection.includes("id=\"article-seo-title\""), true);
    assert.equal(articleEditor.includes("expectedUpdatedAt"), true);
    assert.equal(articleEditor.includes("ArticleSeoSection"), true);
    assert.equal(articleEditor.includes("ArticleSlugEditor") || seoSection.includes("ArticleSlugEditor"), true);
  });

  it("keeps slug mutation on the content slug route with CONTENT_EDIT", () => {
    const slugRoute = readFileSync(
      path.join(apiRoot, "content", "[contentItemId]", "slug", "route.ts"),
      "utf8",
    );
    assert.equal(slugRoute.includes("withEditorWrite"), true);
    assert.equal(slugRoute.includes("CAPABILITY.CONTENT_EDIT"), true);
    assert.equal(slugRoute.includes("updateContentSlug"), true);
    assert.equal(slugRoute.includes("session.staffUserId"), true);
    assert.equal(slugRoute.includes("loadAccessibleContent"), true);
    assert.equal(slugRoute.includes("expectedUpdatedAt"), true);
  });
});
