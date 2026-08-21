import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { staffRenderedOutputLeaksSecrets } from "./presentation";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "../..");

const staffUiFiles = [
  "components/staff-admin-workspace.tsx",
  "components/staff-detail-workspace.tsx",
  "components/staff-confirm-dialog.tsx",
  "components/staff-security-audit-timeline.tsx",
  "lib/staff/client.ts",
  "app/(workspace)/staff/page.tsx",
  "app/(workspace)/staff/[staffUserId]/page.tsx",
];

describe("staff admin UI security boundary", () => {
  for (const relativePath of staffUiFiles) {
    it(`${relativePath} does not reference sensitive credential fields`, () => {
      const source = readFileSync(path.join(root, relativePath), "utf8");
      assert.equal(staffRenderedOutputLeaksSecrets(source), false, relativePath);
    });
  }

  it("detail workspace uses expectedUpdatedAt for mutations", () => {
    const source = readFileSync(
      path.join(root, "components/staff-detail-workspace.tsx"),
      "utf8",
    );
    assert.equal(source.includes("expectedUpdatedAt"), true);
    assert.equal(source.includes("passwordHash"), false);
    assert.equal(source.includes("secretCiphertext"), false);
  });

  it("detail workspace does not collect replacement passwords", () => {
    const source = readFileSync(
      path.join(root, "components/staff-detail-workspace.tsx"),
      "utf8",
    );
    assert.equal(source.includes("type=\"password\""), false);
  });

  it("layout exposes Personel navigation only behind STAFF_MANAGE", () => {
    const source = readFileSync(
      path.join(root, "app/(workspace)/layout.tsx"),
      "utf8",
    );
    assert.match(source, /canManageStaff/);
    assert.match(source, /CAPABILITY\.STAFF_MANAGE/);
    assert.match(source, /href="\/staff"/);
    assert.match(source, /Personel/);
  });
});
