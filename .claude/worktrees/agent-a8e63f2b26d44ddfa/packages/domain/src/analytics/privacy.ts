const FORBIDDEN_ANALYTICS_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "email",
  "phone",
  "staffUserId",
  "staff_user_id",
  "staffId",
  "actorStaffUserId",
  "sessionToken",
  "session_token",
  "sessionId",
  "authToken",
  "authorization",
  "cookie",
  "mfa",
  "totp",
  "totpSecret",
  "recoveryCode",
  "recoveryCodes",
  "secret",
  "secretCiphertext",
  "tokenHash",
  "token_hash",
  "storageKey",
  "storage_key",
  "submittedUrl",
  "submitted_url",
  "rightsNote",
  "rights_note",
  "provenance",
  "internalNote",
  "internal_note",
  "reasonCategory",
  "reason_category",
  "ip",
  "ipAddress",
  "ip_address",
  "fingerprint",
  "canvasFingerprint",
  "audioFingerprint",
  "gps",
  "latitude",
  "longitude",
  "exactGps",
  "searchQuery",
  "queryString",
  "fullReferrer",
  "referrerUrl",
  "referrer",
  "fragment",
  "hash",
  "revenue",
  "billable",
  "cpm",
  "advertiserCost",
  "advertiser_cost",
  "invoiceAmount",
  "invoice_amount",
  "campaignCharge",
  "campaign_charge",
  "userAgent",
  "user_agent",
]);

const POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function analyticsKeyIsForbidden(key: string): boolean {
  return FORBIDDEN_ANALYTICS_KEYS.has(key);
}

export function analyticsObjectHasPollutionKey(key: string): boolean {
  return POLLUTION_KEYS.has(key);
}

/**
 * Defense-in-depth scan. Event validation already allowlists fields; this
 * catches accidental nested leakage of staff/legal/media internals.
 */
export function analyticsEventLeaksSensitiveMaterial(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(analyticsEventLeaksSensitiveMaterial);
  }

  for (const [key, nested] of Object.entries(value)) {
    if (analyticsObjectHasPollutionKey(key) || analyticsKeyIsForbidden(key)) {
      return true;
    }
    if (analyticsEventLeaksSensitiveMaterial(nested)) {
      return true;
    }
  }

  return false;
}
