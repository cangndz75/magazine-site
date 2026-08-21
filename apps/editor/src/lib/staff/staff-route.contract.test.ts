import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.join(
  fileURLToPath(new URL("../../app/api/staff", import.meta.url)),
);

function walkRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkRouteFiles(full));
    } else if (entry.name === "route.ts") {
      files.push(full);
    }
  }
  return files;
}

const files = walkRouteFiles(apiRoot);

describe("staff administration route contracts", () => {
  it("gates every staff route on STAFF_MANAGE and editor session wrappers", () => {
    assert.equal(files.length > 0, true);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.equal(
        source.includes("CAPABILITY.STAFF_MANAGE"),
        true,
        `${file} must require STAFF_MANAGE`,
      );
      const hasGet = source.includes("export async function GET");
      const hasWrite =
        source.includes("export async function POST") ||
        source.includes("export async function PATCH") ||
        source.includes("export async function DELETE");
      if (hasGet) {
        assert.equal(
          source.includes("withEditorRead"),
          true,
          `${file} GET must use withEditorRead`,
        );
      }
      if (hasWrite && source.includes("export async function DELETE")) {
        assert.equal(
          source.includes("withEditorMutation"),
          true,
          `${file} DELETE must use withEditorMutation`,
        );
      } else if (hasWrite) {
        assert.equal(
          source.includes("withEditorWrite"),
          true,
          `${file} mutation must use withEditorWrite`,
        );
      }
      assert.equal(source.includes("body.staffUserId"), false, file);
      assert.equal(source.includes("body.roles"), false, file);
      assert.equal(source.includes("body.capabilities"), false, file);
      assert.equal(source.includes("body.currentSessionId"), false, file);
      assert.equal(source.includes("passwordHash"), false, file);
      assert.equal(source.includes("tokenHash"), false, file);
      assert.equal(source.includes("secretCiphertext"), false, file);
      assert.equal(source.includes("recoveryCode"), false, file);
    }
  });

  it("projects staff JSON through explicit serializers", () => {
    const list = readFileSync(path.join(apiRoot, "route.ts"), "utf8");
    const detail = readFileSync(
      path.join(apiRoot, "[staffUserId]", "route.ts"),
      "utf8",
    );
    const sessions = readFileSync(
      path.join(apiRoot, "[staffUserId]", "sessions", "route.ts"),
      "utf8",
    );
    assert.equal(list.includes("serializeStaffAccountListItem"), true);
    assert.equal(list.includes("listStaffAccounts"), true);
    assert.equal(detail.includes("serializeStaffAccountDetail"), true);
    assert.equal(detail.includes("getStaffAccount"), true);
    assert.equal(sessions.includes("serializeStaffSessionList"), true);
    assert.equal(sessions.includes("listStaffSessions"), true);
  });

  it("takes revoke-all current session identity from the authenticated session", () => {
    const revokeAll = readFileSync(
      path.join(apiRoot, "[staffUserId]", "sessions", "revoke-all", "route.ts"),
      "utf8",
    );
    assert.equal(revokeAll.includes("currentSessionIdForRevokeAll"), true);
    assert.equal(revokeAll.includes("session.sessionId"), true);
    assert.equal(revokeAll.includes("session.staffUserId"), true);
    assert.equal(revokeAll.includes("parsed.currentSessionId"), false);
    assert.equal(revokeAll.includes("body.currentSessionId"), false);
    assert.equal(revokeAll.includes("includeCurrentSession"), true);
  });

  it("does not invent MFA enrollment or secret-export routes", () => {
    const joined = files.map((file) => readFileSync(file, "utf8")).join("\n");
    assert.equal(joined.includes("showSecret"), false);
    assert.equal(joined.includes("qrCode"), false);
    assert.equal(joined.includes("recoveryCodes"), false);
    assert.equal(joined.includes("enroll"), false);
    assert.equal(
      joined.includes("disableStaffMfa"),
      true,
    );
  });

  it("exposes read-only staff security audit route", () => {
    const audit = readFileSync(
      path.join(apiRoot, "[staffUserId]", "security-audit", "route.ts"),
      "utf8",
    );
    assert.equal(audit.includes("CAPABILITY.STAFF_MANAGE"), true);
    assert.equal(audit.includes("listStaffSecurityAuditEvents"), true);
    assert.equal(audit.includes("passwordHash"), false);
    assert.equal(audit.includes("POST"), false);
  });
});
