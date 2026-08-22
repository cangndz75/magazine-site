import {
  FEATURE_CONTROL_TYPE,
  FEATURE_FLAG_KEY,
  KILL_SWITCH_KEY,
  type FeatureControlKey,
  type FeatureControlType,
} from "@magazine/domain";

export const FEATURE_CONTROL_LABEL: Record<FeatureControlKey, string> = {
  [FEATURE_FLAG_KEY.PUBLIC_SEARCH]: "Genel Arama",
  [FEATURE_FLAG_KEY.PUBLIC_GALLERIES]: "Foto Galeriler",
  [FEATURE_FLAG_KEY.EDITORIAL_CALENDAR]: "Yayın Takvimi",
  [KILL_SWITCH_KEY.ANALYTICS_INGESTION]: "Analytics Veri Alımı",
  [KILL_SWITCH_KEY.SCHEDULED_PUBLISHING]: "Zamanlanmış Yayınlama",
  [KILL_SWITCH_KEY.PUBLIC_VIDEO]: "Public Video Yayını",
  [KILL_SWITCH_KEY.HOMEPAGE_CONVERSATION]: "Şu An Konuşuluyor",
};

export const FEATURE_FLAG_EXPLANATION: Record<
  typeof FEATURE_FLAG_KEY[keyof typeof FEATURE_FLAG_KEY],
  string
> = {
  [FEATURE_FLAG_KEY.PUBLIC_SEARCH]:
    "Ziyaretçilerin genel arama sonuçlarını görmesini kontrol eder.",
  [FEATURE_FLAG_KEY.PUBLIC_GALLERIES]:
    "Kamuya açık foto galeri sayfalarının sunulmasını kontrol eder.",
  [FEATURE_FLAG_KEY.EDITORIAL_CALENDAR]:
    "Editör yayın takvimi yüzeyinin kullanılabilirliğini kontrol eder.",
};

export const KILL_SWITCH_IMPACT: Record<
  typeof KILL_SWITCH_KEY[keyof typeof KILL_SWITCH_KEY],
  string
> = {
  [KILL_SWITCH_KEY.ANALYTICS_INGESTION]:
    "Kamuya açık analytics olay alımı durur; yeni trafik verisi kaydedilmez.",
  [KILL_SWITCH_KEY.SCHEDULED_PUBLISHING]:
    "Zamanlanmış yayın işçisi yürütmez; planlı içerikler otomatik yayınlanmaz.",
  [KILL_SWITCH_KEY.PUBLIC_VIDEO]:
    "Kamuya açık video gösterimleri gizlenir; yayınlanmış video yüzeyleri etkilenir.",
  [KILL_SWITCH_KEY.HOMEPAGE_CONVERSATION]:
    "Ana sayfadaki Şu An Konuşuluyor bandı gizlenir.",
};

export function featureControlLabel(key: FeatureControlKey): string {
  return FEATURE_CONTROL_LABEL[key];
}

export function featureFlagStateLabel(enabled: boolean): string {
  return enabled ? "Açık" : "Kapalı";
}

export function killSwitchStateLabel(active: boolean): string {
  return active ? "ACİL DURDURMA AKTİF" : "Normal çalışıyor";
}

export function featureFlagConfirmMessage(key: FeatureControlKey, enabled: boolean): string {
  const label = featureControlLabel(key);
  if (enabled) {
    return `${label} özelliğini yeniden açmak üzeresiniz. Kısıtlanan yüzeyler normale dönebilir.`;
  }
  return `${label} özelliğini kapatmak üzeresiniz. İlgili ürün yüzeyleri devre dışı kalır.`;
}

export function killSwitchConfirmMessage(key: FeatureControlKey, active: boolean): string {
  const label = featureControlLabel(key);
  const impact = KILL_SWITCH_IMPACT[key as typeof KILL_SWITCH_KEY[keyof typeof KILL_SWITCH_KEY]];
  if (active) {
    return `${label} acil durdurmasını etkinleştirmek üzeresiniz. ${impact}`;
  }
  return `${label} acil durdurmasını kapatmak üzeresiniz. İlgili hizmet normale dönebilir; etkiyi doğrulayın.`;
}

export function auditStateLabel(
  type: FeatureControlType,
  enabled: boolean,
): string {
  if (type === FEATURE_CONTROL_TYPE.KILL_SWITCH) {
    return killSwitchStateLabel(enabled);
  }
  return featureFlagStateLabel(enabled);
}

export const FEATURE_FLAG_KEYS = [
  FEATURE_FLAG_KEY.PUBLIC_SEARCH,
  FEATURE_FLAG_KEY.PUBLIC_GALLERIES,
  FEATURE_FLAG_KEY.EDITORIAL_CALENDAR,
] as const;

export const KILL_SWITCH_KEYS = [
  KILL_SWITCH_KEY.ANALYTICS_INGESTION,
  KILL_SWITCH_KEY.SCHEDULED_PUBLISHING,
  KILL_SWITCH_KEY.PUBLIC_VIDEO,
  KILL_SWITCH_KEY.HOMEPAGE_CONVERSATION,
] as const;
