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

describe("Site Health editor route contract", () => {
  it("adds a protected Site Health page without a client API route", () => {
    assert.equal(
      existsSync(path.join(root, "app/(workspace)/site-health/page.tsx")),
      true,
    );
    assert.equal(existsSync(path.join(root, "app/api/site-health/route.ts")), false);
  });

  it("requires STAFF_MANAGE server-side before loading the read model", () => {
    const page = source("app/(workspace)/site-health/page.tsx");
    assert.match(page, /requireCapability\(CAPABILITY\.STAFF_MANAGE\)/);
    assert.match(page, /getSiteHealth/);
    assert.match(page, /editorScopeFromSession/);
    assert.equal(page.includes("CAPABILITY.CONTENT_READ"), false);
    assert.equal(page.includes("CAPABILITY.ANALYTICS_READ"), false);
  });

  it("uses the existing Super Admin capability contract", () => {
    assert.equal(hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.STAFF_MANAGE), true);
    assert.equal(hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.STAFF_MANAGE), false);
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.STAFF_MANAGE), false);
  });

  it("shows navigation only through the existing management group", () => {
    const navigation = source("lib/workspace/navigation.ts");
    assert.match(navigation, /href: "\/site-health"/);
    assert.match(navigation, /Sistem Sağlığı/);
    assert.match(navigation, /input\.canManageStaff/);
  });

  it("does not reference sensitive DTO fields in the page", () => {
    const page = source("app/(workspace)/site-health/page.tsx");
    for (const token of [
      "storageKey",
      "databaseUrl",
      "passwordHash",
      "tokenHash",
      "secretCiphertext",
      "recoveryCode",
      "eventId",
      "anonymousId",
    ]) {
      assert.equal(page.includes(token), false, token);
    }
  });
});
