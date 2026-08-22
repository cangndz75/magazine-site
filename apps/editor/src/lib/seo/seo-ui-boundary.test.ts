import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { seoRenderedOutputLeaksSecrets } from "./presentation";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "../..");

const seoUiFiles = [
  "components/seo-workspace.tsx",
  "components/seo-toolbar.tsx",
  "components/seo-list.tsx",
  "components/seo-summary.tsx",
  "components/seo-inspector.tsx",
  "components/seo-slug-history.tsx",
  "components/seo-preview-panels.tsx",
  "components/article-seo-section.tsx",
  "components/article-slug-editor.tsx",
  "lib/seo/serialize.ts",
  "app/(workspace)/seo/page.tsx",
  "app/(workspace)/seo/[contentItemId]/page.tsx",
  "app/api/seo/content/route.ts",
  "app/api/seo/content/[contentItemId]/route.ts",
];

describe("SEO UI security boundary", () => {
  for (const relativePath of seoUiFiles) {
    it(`${relativePath} does not reference sensitive credential or media internals`, () => {
      const source = readFileSync(path.join(root, relativePath), "utf8");
      assert.equal(seoRenderedOutputLeaksSecrets(source), false, relativePath);
    });
  }

  it("keeps slug history read-only and robots as a closed select", () => {
    const history = readFileSync(
      path.join(root, "components/seo-slug-history.tsx"),
      "utf8",
    );
    const seoSection = readFileSync(
      path.join(root, "components/article-seo-section.tsx"),
      "utf8",
    );
    assert.match(history, /URL Geçmişi/);
    assert.match(history, /kalıcı olarak yönlendirilir/);
    assert.equal(history.includes("onDelete"), false);
    assert.equal(history.includes("type=\"password\""), false);
    assert.match(seoSection, /id="article-robots"/);
    assert.equal(seoSection.includes("id=\"article-robots\"") && seoSection.includes("<select"), true);
    assert.equal(seoSection.includes("index\" toggle"), false);
  });

  it("layout exposes SEO navigation only behind CONTENT_READ", () => {
    const source = readFileSync(
      path.join(root, "app/(workspace)/layout.tsx"),
      "utf8",
    );
    const navigation = readFileSync(
      path.join(root, "lib/workspace/navigation.ts"),
      "utf8",
    );
    assert.match(source, /canReadContent/);
    assert.match(navigation, /href: "\/seo"/);
  });
});
