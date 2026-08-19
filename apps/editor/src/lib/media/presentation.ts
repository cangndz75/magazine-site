import {
  MEDIA_LICENSE_TYPE,
  MEDIA_LICENSE_TYPES,
  MEDIA_PUBLIC_INELIGIBILITY_REASON,
  MEDIA_RIGHTS_STATUS,
  MEDIA_SOURCE_KIND,
  MEDIA_SOURCE_KINDS,
  MEDIA_USAGE_RESTRICTION,
  MEDIA_USAGE_RESTRICTIONS,
  type MediaLicenseType,
  type MediaPublicIneligibilityReason,
  type MediaRightsStatus,
  type MediaSourceKind,
  type MediaUsageRestriction,
} from "@magazine/domain";

export type RightsStatusPresentation = {
  label: string;
  tone: "ok" | "warn" | "danger" | "muted";
  icon: string;
};

export const RIGHTS_STATUS_PRESENTATION: Record<
  MediaRightsStatus,
  RightsStatusPresentation
> = {
  [MEDIA_RIGHTS_STATUS.CLEARED]: {
    label: "Kullanıma uygun",
    tone: "ok",
    icon: "✓",
  },
  [MEDIA_RIGHTS_STATUS.INCOMPLETE]: {
    label: "Hak bilgisi eksik",
    tone: "warn",
    icon: "!",
  },
  [MEDIA_RIGHTS_STATUS.RESTRICTED]: {
    label: "Kısıtlı",
    tone: "danger",
    icon: "⊘",
  },
  [MEDIA_RIGHTS_STATUS.EXPIRED]: {
    label: "Süresi dolmuş",
    tone: "danger",
    icon: "⏱",
  },
  [MEDIA_RIGHTS_STATUS.NOT_STARTED]: {
    label: "Lisans başlamadı",
    tone: "warn",
    icon: "◷",
  },
};

export const INELIGIBILITY_REASON_LABELS: Record<
  MediaPublicIneligibilityReason,
  string
> = {
  [MEDIA_PUBLIC_INELIGIBILITY_REASON.RIGHTS_INCOMPLETE]:
    "Hak bilgisi eksik (kaynak, lisans, hak sahibi veya kredi gerekli).",
  [MEDIA_PUBLIC_INELIGIBILITY_REASON.LICENSE_NOT_STARTED]:
    "Lisans henüz başlamadı.",
  [MEDIA_PUBLIC_INELIGIBILITY_REASON.LICENSE_EXPIRED]: "Lisans süresi doldu.",
  [MEDIA_PUBLIC_INELIGIBILITY_REASON.USAGE_RESTRICTED]:
    "Kullanım kısıtlaması nedeniyle yayına uygun değil.",
};

export const SOURCE_KIND_LABELS: Record<MediaSourceKind, string> = {
  [MEDIA_SOURCE_KIND.UNKNOWN]: "Bilinmiyor",
  [MEDIA_SOURCE_KIND.OWNED]: "Kurum içi",
  [MEDIA_SOURCE_KIND.COMMISSIONED]: "Görevlendirme",
  [MEDIA_SOURCE_KIND.LICENSED]: "Lisanslı",
  [MEDIA_SOURCE_KIND.AGENCY]: "Ajans",
  [MEDIA_SOURCE_KIND.UGC]: "Kullanıcı içeriği",
};

export const LICENSE_TYPE_LABELS: Record<MediaLicenseType, string> = {
  [MEDIA_LICENSE_TYPE.UNKNOWN]: "Bilinmiyor",
  [MEDIA_LICENSE_TYPE.ALL_RIGHTS]: "Tüm haklar",
  [MEDIA_LICENSE_TYPE.COMMISSIONED]: "Görevlendirme",
  [MEDIA_LICENSE_TYPE.EDITORIAL]: "Editoryal",
  [MEDIA_LICENSE_TYPE.CREATIVE_COMMONS]: "Creative Commons",
  [MEDIA_LICENSE_TYPE.OTHER]: "Diğer",
};

export const USAGE_RESTRICTION_LABELS: Record<MediaUsageRestriction, string> = {
  [MEDIA_USAGE_RESTRICTION.NONE]: "Kısıt yok",
  [MEDIA_USAGE_RESTRICTION.EDITORIAL_ONLY]: "Yalnızca editoryal",
  [MEDIA_USAGE_RESTRICTION.RESTRICTED]: "Kısıtlı",
};

export const MEDIA_TYPE_LABELS = {
  IMAGE: "Görsel",
  VIDEO: "Video",
  AUDIO: "Ses",
} as const;

export function formatDimensions(
  width: number | null,
  height: number | null,
): string | null {
  if (width === null || height === null) {
    return null;
  }
  return `${width}×${height}`;
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const RIGHTS_FORM_OPTIONS = {
  sourceKinds: MEDIA_SOURCE_KINDS,
  licenseTypes: MEDIA_LICENSE_TYPES,
  usageRestrictions: MEDIA_USAGE_RESTRICTIONS,
};
