import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_CONSENT_POLICY,
  ANALYTICS_SESSION_POLICY,
  ANALYTICS_VISITOR_POLICY,
  analyticsEventLeaksSensitiveMaterial,
} from "./index";

describe("analytics privacy boundary", () => {
  it("forbids staff, auth, MFA, legal, media, and identity leakage keys", () => {
    assert.equal(analyticsEventLeaksSensitiveMaterial({ email: "a@b.com" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ phone: "+1" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ staffUserId: "x" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ authToken: "x" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ totp: "123456" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ recoveryCodes: [] }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ storageKey: "k" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ internalNote: "counsel" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ reasonCategory: "PRIVACY" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ submittedUrl: "https://x" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ rightsNote: "contract" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ ipAddress: "1.1.1.1" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ fingerprint: "abc" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ referrerUrl: "https://x/y" }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ revenue: 12 }), true);
    assert.equal(analyticsEventLeaksSensitiveMaterial({ userAgent: "Mozilla" }), true);
    assert.equal(
      analyticsEventLeaksSensitiveMaterial({
        properties: { contentItemId: "ok" },
      }),
      false,
    );
  });

  it("keeps public analytics session separate from staff auth and skips durable visitor IDs", () => {
    assert.equal(ANALYTICS_VISITOR_POLICY.DURABLE_VISITOR_ID_ENABLED, false);
    assert.equal(ANALYTICS_VISITOR_POLICY.FINGERPRINTING_FORBIDDEN, true);
    assert.equal(ANALYTICS_VISITOR_POLICY.IP_AS_VISITOR_ID_FORBIDDEN, true);
    assert.equal(ANALYTICS_SESSION_POLICY.COOKIE_NAME.includes("editor"), false);
    assert.equal(ANALYTICS_SESSION_POLICY.INACTIVITY_TIMEOUT_MS, 30 * 60 * 1000);
    assert.equal(ANALYTICS_CONSENT_POLICY.COOKIE_BANNER_IMPLEMENTED, false);
    assert.equal(ANALYTICS_CONSENT_POLICY.SESSIONLESS_EVENTS_ALLOWED_WITHOUT_GRANT, true);
  });
});
