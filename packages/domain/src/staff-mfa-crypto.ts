import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const MFA_SECRET_CIPHERTEXT_VERSION = 1 as const;
export const MFA_ENCRYPTION_KEY_BYTES = 32;
export const MFA_GCM_IV_BYTES = 12;
export const MFA_GCM_TAG_BYTES = 16;

export class MfaCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MfaCryptoError";
  }
}

export function parseMfaEncryptionKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new MfaCryptoError("MFA encryption key is missing.");
  }

  let key: Buffer;
  try {
    key = Buffer.from(trimmed, "base64url");
    if (key.length !== MFA_ENCRYPTION_KEY_BYTES) {
      const fallback = Buffer.from(trimmed, "base64");
      if (fallback.length === MFA_ENCRYPTION_KEY_BYTES) {
        key = fallback;
      }
    }
  } catch {
    throw new MfaCryptoError("MFA encryption key is not valid base64.");
  }

  if (key.length !== MFA_ENCRYPTION_KEY_BYTES) {
    throw new MfaCryptoError(
      `MFA encryption key must decode to ${MFA_ENCRYPTION_KEY_BYTES} bytes.`,
    );
  }

  return key;
}

/**
 * Versioned authenticated ciphertext: v1.<base64url(iv)>.<base64url(ciphertext+tag)>
 */
export function encryptMfaSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(MFA_GCM_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([encrypted, tag]);
  return `${MFA_SECRET_CIPHERTEXT_VERSION}.${iv.toString("base64url")}.${payload.toString("base64url")}`;
}

export function decryptMfaSecret(ciphertext: string, key: Buffer): string {
  const parts = ciphertext.split(".");
  if (parts.length !== 3) {
    throw new MfaCryptoError("MFA ciphertext format is invalid.");
  }

  const [versionRaw, ivRaw, payloadRaw] = parts;
  if (Number.parseInt(versionRaw ?? "", 10) !== MFA_SECRET_CIPHERTEXT_VERSION) {
    throw new MfaCryptoError("MFA ciphertext version is unsupported.");
  }

  let iv: Buffer;
  let payload: Buffer;
  try {
    iv = Buffer.from(ivRaw ?? "", "base64url");
    payload = Buffer.from(payloadRaw ?? "", "base64url");
  } catch {
    throw new MfaCryptoError("MFA ciphertext payload is malformed.");
  }

  if (iv.length !== MFA_GCM_IV_BYTES || payload.length <= MFA_GCM_TAG_BYTES) {
    throw new MfaCryptoError("MFA ciphertext payload is malformed.");
  }

  const encrypted = payload.subarray(0, payload.length - MFA_GCM_TAG_BYTES);
  const tag = payload.subarray(payload.length - MFA_GCM_TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new MfaCryptoError("MFA ciphertext authentication failed.");
  }
}

export function mfaEncryptionKeysEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
