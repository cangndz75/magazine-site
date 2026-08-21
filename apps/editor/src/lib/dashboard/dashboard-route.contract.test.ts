import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { CAPABILITY, NEWSROOM_VIEW, STAFF_ROLE, hasCapability, parseNewsroomView } from "@magazine/domain";

const root = path.join(fileURLToPath(new URL(".", import.meta.url)), "../..");

function source(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("Super Admin dashboard route contract", () => {
  it("keeps the newsroom root and adds dashboard as a separate route", () => {
    assert.equal(existsSync(path.join(root, "app/(workspace)/page.tsx")), true);
    assert.equal(
      existsSync(path.join(root, "app/(workspace)/dashboard/page.tsx")),
      true,
    );
  });

  it("requires STAFF_MANAGE server-side before loading the dashboard read model", () => {
    const page = source("app/(workspace)/dashboard/page.tsx");
    assert.match(page, /requireCapability\(CAPABILITY\.STAFF_MANAGE\)/);
    assert.match(page, /getSuperAdminDashboard/);
    assert.match(page, /editorScopeFromSession/);
    assert.equal(page.includes("CAPABILITY.CONTENT_READ"), false);
    assert.equal(page.includes("CAPABILITY.ANALYTICS_READ"), false);
  });

  it("uses the existing role capability contract for Super Admin-only access", () => {
    assert.equal(
      hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.STAFF_MANAGE),
      true,
    );
    assert.equal(hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.STAFF_MANAGE), false);
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.STAFF_MANAGE), false);
  });

  it("shows dashboard navigation only behind the staff management capability", () => {
    const layout = source("app/(workspace)/layout.tsx");
    assert.match(layout, /canManageStaff/);
    assert.match(layout, /CAPABILITY\.STAFF_MANAGE/);
    assert.match(layout, /href="\/dashboard"/);
    assert.match(layout, /Kontrol Merkezi/);
  });

  it("does not expose dashboard data through a client API route", () => {
    assert.equal(existsSync(path.join(root, "app/api/dashboard/route.ts")), false);
  });

  it("deep-links newsroom views with the lowercase slugs the desk parser accepts", () => {
    const editorial = source("components/dashboard/dashboard-editorial-operations.tsx");
    const attention = source("components/dashboard/dashboard-attention.tsx");
    const upcoming = source("components/dashboard/dashboard-upcoming-publishing.tsx");
    assert.match(editorial, /NEWSROOM_VIEW/);
    assert.equal(editorial.includes("view=DRAFTS"), false);
    assert.equal(editorial.includes("view=IN_REVIEW"), false);
    assert.equal(editorial.includes("view=ATTENTION"), false);
    assert.equal(editorial.includes("view=SCHEDULED"), false);
    assert.equal(editorial.includes("view=PUBLISHED"), false);
    assert.match(attention, /NEWSROOM_VIEW\.ATTENTION/);
    assert.match(upcoming, /NEWSROOM_VIEW\.SCHEDULED/);
    assert.equal(parseNewsroomView("DRAFTS"), NEWSROOM_VIEW.ALL);
    assert.equal(parseNewsroomView(NEWSROOM_VIEW.DRAFTS), NEWSROOM_VIEW.DRAFTS);
    assert.equal(parseNewsroomView(NEWSROOM_VIEW.IN_REVIEW), NEWSROOM_VIEW.IN_REVIEW);
  });

  it("does not reference sensitive DTO fields in the dashboard page", () => {
    const page = source("app/(workspace)/dashboard/page.tsx");
    for (const token of [
      "body",
      "storageKey",
      "rightsNote",
      "internalNote",
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
