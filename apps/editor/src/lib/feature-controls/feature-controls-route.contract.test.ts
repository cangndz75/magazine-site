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

describe("Feature controls editor route contract", () => {
  it("adds a protected feature controls page", () => {
    assert.equal(
      existsSync(path.join(root, "app/(workspace)/feature-controls/page.tsx")),
      true,
    );
  });

  it("requires STAFF_MANAGE server-side before loading controls", () => {
    const page = source("app/(workspace)/feature-controls/page.tsx");
    assert.match(page, /requireCapability\(CAPABILITY\.STAFF_MANAGE\)/);
    assert.match(page, /listFeatureControls/);
    assert.match(page, /listRecentFeatureControlAuditEvents/);
  });

  it("uses the existing Super Admin capability contract", () => {
    assert.equal(hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.STAFF_MANAGE), true);
    assert.equal(hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.STAFF_MANAGE), false);
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.STAFF_MANAGE), false);
  });

  it("shows navigation only through the management group", () => {
    const navigation = source("lib/workspace/navigation.ts");
    assert.match(navigation, /href: "\/feature-controls"/);
    assert.match(navigation, /Özellik Kontrolleri/);
    assert.match(navigation, /input\.canManageStaff/);
  });

  it("gates API routes on STAFF_MANAGE and editor wrappers", () => {
    const listRoute = source("app/api/feature-controls/route.ts");
    const patchRoute = source("app/api/feature-controls/[key]/route.ts");
    assert.match(listRoute, /CAPABILITY\.STAFF_MANAGE/);
    assert.match(listRoute, /withEditorRead/);
    assert.match(patchRoute, /CAPABILITY\.STAFF_MANAGE/);
    assert.match(patchRoute, /withEditorWrite/);
    assert.match(patchRoute, /expectedUpdatedAt/);
  });

  it("does not reference sensitive tokens in the page", () => {
    const page = source("app/(workspace)/feature-controls/page.tsx");
    for (const token of [
      "passwordHash",
      "tokenHash",
      "secretCiphertext",
      "databaseUrl",
      "connectionString",
    ]) {
      assert.equal(page.includes(token), false, token);
    }
  });
});
