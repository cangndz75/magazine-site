import { STAFF_MFA_ERROR } from "@magazine/domain";

export type MfaFailurePresentation = {
  message: string;
  recoverToPasswordLogin: boolean;
};

const LOGIN_CHALLENGE_MESSAGES: Record<string, MfaFailurePresentation> = {
  [STAFF_MFA_ERROR.INVALID_TOTP_CODE]: {
    message: "Doğrulama kodu geçersiz. Lütfen tekrar deneyin.",
    recoverToPasswordLogin: false,
  },
  [STAFF_MFA_ERROR.INVALID_RECOVERY_CODE]: {
    message: "Kurtarma kodu geçersiz veya daha önce kullanılmış.",
    recoverToPasswordLogin: false,
  },
  [STAFF_MFA_ERROR.CHALLENGE_EXPIRED]: {
    message:
      "Doğrulama süresi doldu. Güvenlik için yeniden parola ile giriş yapın.",
    recoverToPasswordLogin: true,
  },
  [STAFF_MFA_ERROR.CHALLENGE_CONSUMED]: {
    message:
      "Bu doğrulama oturumu zaten tamamlandı. Yeniden parola ile giriş yapın.",
    recoverToPasswordLogin: true,
  },
  [STAFF_MFA_ERROR.CHALLENGE_NOT_FOUND]: {
    message:
      "Doğrulama oturumu bulunamadı. Yeniden parola ile giriş yapın.",
    recoverToPasswordLogin: true,
  },
  [STAFF_MFA_ERROR.CHALLENGE_LOCKED]: {
    message:
      "Çok fazla hatalı deneme yapıldı. Güvenlik için yeniden parola ile giriş yapın.",
    recoverToPasswordLogin: true,
  },
  [STAFF_MFA_ERROR.TOTP_REPLAY]: {
    message:
      "Bu kod az önce kullanıldı. Authenticator uygulamanızdaki yeni kodu girin.",
    recoverToPasswordLogin: false,
  },
  [STAFF_MFA_ERROR.FORBIDDEN]: {
    message:
      "Hesabınız şu anda doğrulama tamamlamaya uygun değil. Yöneticinizle iletişime geçin.",
    recoverToPasswordLogin: true,
  },
  [STAFF_MFA_ERROR.MFA_NOT_ENROLLED]: {
    message:
      "İki adımlı doğrulama artık etkin değil. Yeniden parola ile giriş yapın.",
    recoverToPasswordLogin: true,
  },
  UNAUTHENTICATED: {
    message:
      "Doğrulama oturumu bulunamadı. Yeniden parola ile giriş yapın.",
    recoverToPasswordLogin: true,
  },
};

const ENROLLMENT_MESSAGES: Record<string, string> = {
  [STAFF_MFA_ERROR.INVALID_TOTP_CODE]:
    "Authenticator kodu geçersiz. Uygulamanızdaki güncel kodu girin.",
  [STAFF_MFA_ERROR.MFA_ALREADY_ACTIVE]:
    "İki adımlı doğrulama zaten etkin.",
  [STAFF_MFA_ERROR.MFA_ENROLLMENT_NOT_PENDING]:
    "Kayıt oturumu geçersiz. Lütfen kurulumu yeniden başlatın.",
  [STAFF_MFA_ERROR.STEP_UP_REQUIRED]:
    "Devam etmek için mevcut parolanızı doğrulayın.",
  [STAFF_MFA_ERROR.MFA_NOT_ENROLLED]:
    "İki adımlı doğrulama etkin değil.",
  [STAFF_MFA_ERROR.FORBIDDEN]: "Bu işlem şu anda yapılamıyor.",
  [STAFF_MFA_ERROR.CRYPTO_ERROR]:
    "Güvenlik yapılandırması eksik. Yöneticinizle iletişime geçin.",
};

export function presentMfaLoginFailure(
  code: string | undefined,
): MfaFailurePresentation {
  if (code && LOGIN_CHALLENGE_MESSAGES[code]) {
    return LOGIN_CHALLENGE_MESSAGES[code]!;
  }
  return {
    message: "Doğrulama tamamlanamadı. Lütfen tekrar deneyin.",
    recoverToPasswordLogin: false,
  };
}

export function presentMfaEnrollmentFailure(code: string | undefined): string {
  if (code && ENROLLMENT_MESSAGES[code]) {
    return ENROLLMENT_MESSAGES[code]!;
  }
  return "İşlem tamamlanamadı. Lütfen tekrar deneyin.";
}

export function normalizeClientTotpInput(raw: string): string | null {
  const digits = raw.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(digits)) {
    return null;
  }
  return digits;
}

export function normalizeClientRecoveryInput(raw: string): string | null {
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "");
  const pattern =
    /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-?[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;
  if (!pattern.test(normalized)) {
    return null;
  }
  const compact = normalized.replace("-", "");
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export function formatRecoveryCodesForCopy(codes: readonly string[]): string {
  return codes.join("\n");
}

export function buildRecoveryCodesDownloadFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `magazine-editor-kurtarma-kodlari-${stamp}.txt`;
}

export const SENSITIVE_MFA_STORAGE_KEYS = [
  "mfaSecret",
  "otpauthUri",
  "recoveryCodes",
  "totpCode",
  "challengeToken",
] as const;

export function containsSensitiveMfaMaterial(text: string): boolean {
  const lowered = text.toLowerCase();
  if (lowered.includes("otpauth://")) {
    return true;
  }
  if (/\b\d{6}\b/.test(text) && lowered.includes("secret")) {
    return true;
  }
  return SENSITIVE_MFA_STORAGE_KEYS.some((key) => lowered.includes(key.toLowerCase()));
}
