import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("MFA login UI contracts", () => {
  it("routes MFA_REQUIRED login to challenge UI without sensitive query params", () => {
    const loginPage = readFileSync(
      path.join(root, "app/login/page.tsx"),
      "utf8",
    );
    const loginRoute = readFileSync(
      path.join(root, "app/api/auth/login/route.ts"),
      "utf8",
    );
    const challenge = readFileSync(
      path.join(root, "components/login-mfa-challenge.tsx"),
      "utf8",
    );

    const mfaClient = readFileSync(
      path.join(root, "lib/auth/mfa-client.ts"),
      "utf8",
    );

    assert.equal(loginPage.includes("LoginMfaChallenge"), true);
    assert.equal(loginPage.includes('params.mfa === "1"'), true);
    assert.equal(loginRoute.includes("mfa=1"), true);
    assert.equal(loginRoute.includes("challengeToken="), false);
    assert.equal(challenge.includes("localStorage"), false);
    assert.equal(challenge.includes("sessionStorage"), false);
    assert.equal(mfaClient.includes("/api/auth/mfa/challenge/verify"), true);
    assert.equal(challenge.includes("Kurtarma kodu kullan"), true);
  });

  it("keeps security settings free of secret re-export routes", () => {
    const securityPage = readFileSync(
      path.join(root, "app/(workspace)/settings/security/page.tsx"),
      "utf8",
    );
    const workspace = readFileSync(
      path.join(root, "components/security-settings-workspace.tsx"),
      "utf8",
    );

    assert.equal(securityPage.includes("getSelfServiceMfaStatus"), true);
    assert.equal(securityPage.includes("secret"), false);
    assert.equal(securityPage.includes("otpauthUri"), false);
    assert.equal(workspace.includes("MfaRecoveryCodesDisplay"), true);
    assert.equal(workspace.includes("localStorage"), false);
    assert.equal(workspace.includes("sessionStorage"), false);
  });

  it("uses local QR generation without external services", () => {
    const qrSetup = readFileSync(
      path.join(root, "components/mfa-qr-setup.tsx"),
      "utf8",
    );
    assert.equal(qrSetup.includes("qrcode"), true);
    assert.equal(qrSetup.includes("api.qr"), false);
    assert.equal(qrSetup.includes("googleapis"), false);
  });
});
