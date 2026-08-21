import {
  STAFF_ADMIN_ERROR,
  STAFF_MFA_FACTOR_STATUS,
  STAFF_ROLE,
  STAFF_SCOPE_MODE,
  STAFF_SECURITY_AUDIT_EVENT_TYPE,
  STAFF_SESSION_STATE,
  STAFF_STATUS,
  type StaffMfaFactorStatus,
  type StaffRole,
  type StaffScopeMode,
  type StaffSecurityAuditEventType,
  type StaffStatus,
} from "@magazine/domain";

export function presentStaffAdminFailure(code: string | undefined): {
  message: string;
  isConflict: boolean;
} {
  switch (code) {
    case STAFF_ADMIN_ERROR.FORBIDDEN:
    case "FORBIDDEN":
      return {
        message: "Bu işlem için yetkiniz yok.",
        isConflict: false,
      };
    case STAFF_ADMIN_ERROR.STAFF_NOT_FOUND:
    case "STAFF_NOT_FOUND":
      return {
        message: "Personel kaydı bulunamadı.",
        isConflict: false,
      };
    case STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT:
    case "STAFF_WRITE_CONFLICT":
      return {
        message:
          "Kayıt başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.",
        isConflict: true,
      };
    case STAFF_ADMIN_ERROR.LAST_SUPER_ADMIN:
    case "LAST_SUPER_ADMIN":
      return {
        message: "Son geçerli Süper Admin hesabı bu işleme izin vermiyor.",
        isConflict: false,
      };
    case STAFF_ADMIN_ERROR.INVALID_ROLE:
    case "INVALID_STAFF_ROLE":
      return {
        message: "Seçilen rol geçersiz.",
        isConflict: false,
      };
    case STAFF_ADMIN_ERROR.INVALID_SCOPE:
    case "INVALID_STAFF_SCOPE":
      return {
        message: "Kategori kapsamı geçersiz.",
        isConflict: false,
      };
    case STAFF_ADMIN_ERROR.INVALID_STATUS:
    case "INVALID_ACCOUNT_TRANSITION":
      return {
        message: "Hesap durumu bu işlem için uygun değil.",
        isConflict: false,
      };
    case STAFF_ADMIN_ERROR.SESSION_NOT_FOUND:
    case "SESSION_NOT_FOUND":
      return {
        message: "Oturum bulunamadı veya zaten sonlandırılmış.",
        isConflict: false,
      };
    case STAFF_ADMIN_ERROR.MFA_NOT_ENROLLED:
    case "MFA_NOT_ENROLLED":
      return {
        message: "Bu hesapta devre dışı bırakılacak MFA kaydı yok.",
        isConflict: false,
      };
    default:
      return {
        message: "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
        isConflict: false,
      };
  }
}

export function staffStatusLabel(status: StaffStatus): string {
  return status === STAFF_STATUS.ACTIVE ? "Aktif" : "Devre dışı";
}

export function staffRoleLabel(role: StaffRole): string {
  switch (role) {
    case STAFF_ROLE.SUPER_ADMIN:
      return "Süper Admin";
    case STAFF_ROLE.EDITOR:
      return "Editör";
    case STAFF_ROLE.AUTHOR:
      return "Yazar";
    default:
      return role;
  }
}

export function staffScopeModeLabel(mode: StaffScopeMode): string {
  return mode === STAFF_SCOPE_MODE.ALL ? "Tüm kategoriler" : "Seçili kategoriler";
}

export function staffMfaStatusLabel(input: {
  enrolled: boolean;
  status: StaffMfaFactorStatus | "NONE";
}): string {
  if (input.enrolled) {
    return "MFA etkin";
  }
  if (input.status === STAFF_MFA_FACTOR_STATUS.PENDING) {
    return "MFA kurulumu bekliyor";
  }
  if (input.status === STAFF_MFA_FACTOR_STATUS.DISABLED) {
    return "MFA devre dışı";
  }
  return "MFA yok";
}

export function staffSessionStateLabel(
  state: (typeof STAFF_SESSION_STATE)[keyof typeof STAFF_SESSION_STATE],
): string {
  switch (state) {
    case STAFF_SESSION_STATE.ACTIVE:
      return "Aktif";
    case STAFF_SESSION_STATE.REVOKED:
      return "Sonlandırıldı";
    case STAFF_SESSION_STATE.EXPIRED:
      return "Süresi doldu";
    default:
      return state;
  }
}

const AUDIT_EVENT_LABELS: Record<StaffSecurityAuditEventType, string> = {
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SUSPENDED]: "Hesap askıya alındı",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_REACTIVATED]: "Hesap yeniden etkinleştirildi",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_ROLE_CHANGED]: "Roller güncellendi",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SCOPE_CHANGED]: "Kategori kapsamı güncellendi",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SESSION_REVOKED]: "Oturum sonlandırıldı",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_SESSIONS_REVOKED_ALL]:
    "Tüm oturumlar sonlandırıldı",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_MFA_DISABLED]: "MFA devre dışı bırakıldı",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.STAFF_PASSWORD_RESET_REQUIRED]:
    "Parola sıfırlama zorunlu kılındı",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_ENROLLMENT_STARTED]: "MFA kaydı başlatıldı",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_ENABLED]: "MFA etkinleştirildi",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_RECOVERY_CODES_REGENERATED]:
    "Kurtarma kodları yenilendi",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_RECOVERY_CODE_USED]:
    "Kurtarma kodu ile giriş yapıldı",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_LOGIN_SUCCEEDED]: "MFA ile giriş tamamlandı",
  [STAFF_SECURITY_AUDIT_EVENT_TYPE.MFA_CHALLENGE_LOCKED]:
    "MFA doğrulama kilitlendi",
};

export function staffSecurityAuditEventLabel(
  eventType: StaffSecurityAuditEventType,
): string {
  return AUDIT_EVENT_LABELS[eventType] ?? eventType;
}

export function summarizeStaffSecurityAuditChangeSet(
  changeSet: Record<string, unknown> | null,
): string | null {
  if (!changeSet) {
    return null;
  }
  const parts: string[] = [];
  if (typeof changeSet.previousStatus === "string" && typeof changeSet.nextStatus === "string") {
    parts.push(`${changeSet.previousStatus} → ${changeSet.nextStatus}`);
  }
  if (Array.isArray(changeSet.previousRoles) && Array.isArray(changeSet.nextRoles)) {
    parts.push(`Roller: ${changeSet.nextRoles.join(", ")}`);
  }
  if (typeof changeSet.scopeMode === "string") {
    parts.push(`Kapsam: ${changeSet.scopeMode}`);
  }
  if (typeof changeSet.revokedSessionCount === "number") {
    parts.push(`${changeSet.revokedSessionCount} oturum sonlandırıldı`);
  }
  if (typeof changeSet.usedRecovery === "boolean" && changeSet.usedRecovery) {
    parts.push("Kurtarma kodu kullanıldı");
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function shortenStaffId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

export const SENSITIVE_STAFF_RENDER_PATTERNS = [
  "passwordHash",
  "tokenHash",
  "secretCiphertext",
  "recoveryCodeHash",
  "recoveryCodes",
  "otpauth",
] as const;

export function staffRenderedOutputLeaksSecrets(source: string): boolean {
  const lowered = source.toLowerCase();
  return SENSITIVE_STAFF_RENDER_PATTERNS.some((pattern) =>
    lowered.includes(pattern.toLowerCase()),
  );
}

const CAPABILITY_LABELS: Record<string, string> = {
  CONTENT_READ: "İçerik okuma",
  CONTENT_CREATE: "İçerik oluşturma",
  CONTENT_EDIT: "İçerik düzenleme",
  CONTENT_REVIEW: "İçerik inceleme",
  CONTENT_PUBLISH: "Yayınlama",
  CONTENT_LEGAL: "Yasal işlemler",
  CATEGORY_MANAGE: "Kategori yönetimi",
  HOMEPAGE_MANAGE: "Ana sayfa yönetimi",
  STAFF_MANAGE: "Personel yönetimi",
  ANALYTICS_READ: "Analitik okuma",
};

export function staffCapabilityLabel(capability: string): string {
  return CAPABILITY_LABELS[capability] ?? capability;
}

export const STAFF_ROLE_IMPACT: Record<StaffRole, string> = {
  SUPER_ADMIN:
    "Tam yönetim erişimi: personel, ana sayfa, yasal işlemler ve tüm içerik yetkileri.",
  EDITOR:
    "İçerik oluşturma, düzenleme, inceleme ve yayınlama. Personel ve ana sayfa yönetimi yok.",
  AUTHOR: "Kendi kapsamındaki içerikleri oluşturma ve düzenleme.",
};

