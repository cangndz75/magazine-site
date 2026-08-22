import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CAPABILITY, STAFF_ROLE, hasCapability } from "@magazine/domain";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "../..");

function source(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Redirect management editor route contract", () => {
  it("adds a protected redirects page under SEO", () => {
    assert.equal(
      existsSync(path.join(root, "app/(workspace)/seo/redirects/page.tsx")),
      true,
    );
  });

  it("requires CONTENT_PUBLISH server-side before loading redirects", () => {
    const page = source("app/(workspace)/seo/redirects/page.tsx");
    assert.match(page, /requireCapability\(CAPABILITY\.CONTENT_PUBLISH\)/);
    assert.match(page, /listRedirectRules/);
  });

  it("uses CONTENT_PUBLISH capability contract", () => {
    assert.equal(hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.CONTENT_PUBLISH), true);
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.CONTENT_PUBLISH), false);
  });

  it("gates redirect API routes on CONTENT_PUBLISH", () => {
    const list = source("app/api/redirects/route.ts");
    const detail = source("app/api/redirects/[redirectRuleId]/route.ts");
    assert.match(list, /CAPABILITY\.CONTENT_PUBLISH/);
    assert.match(list, /withEditorRead/);
    assert.match(list, /withEditorWrite/);
    assert.match(detail, /expectedUpdatedAt/);
    assert.match(detail, /withEditorWrite/);
  });

  it("links from SEO command center when publisher", () => {
    const seoPage = source("app/(workspace)/seo/page.tsx");
    const seoWorkspace = source("components/seo-workspace.tsx");
    assert.match(seoPage, /canManageRedirects/);
    assert.match(seoWorkspace, /\/seo\/redirects/);
  });

  it("does not expose sensitive tokens in redirect page", () => {
    const page = source("app/(workspace)/seo/redirects/page.tsx");
    for (const token of ["passwordHash", "tokenHash", "databaseUrl"]) {
      assert.equal(page.includes(token), false, token);
    }
  });
});
