import {
  DISCOVER_FINDING_CLASS,
  DISCOVER_READINESS,
  PUBLIC_INDEXABILITY_REASON,
  SEO_CANONICAL_OVERRIDE_REJECTION,
  SEO_FINDING_CODE,
  SEO_FINDING_KIND,
  SEO_FINDING_SEVERITY,
  type DiscoverFinding,
  type DiscoverFindingClass,
  type DiscoverReadinessState,
  type PublicIndexabilityDecision,
  type SeoCanonicalOverrideRejection,
  type SeoFinding,
  type SeoFindingCode,
} from "@magazine/domain";

export type SeoFindingCopy = {
  title: string;
  why: string;
  where: string;
  actionable: boolean;
};

const FINDING_COPY: Record<SeoFindingCode, SeoFindingCopy> = {
  [SEO_FINDING_CODE.TITLE_MISSING]: {
    title: "Makale başlığı eksik",
    why: "Arama ve yapılandırılmış veri için başlık zorunludur.",
    where: "Makale editöründe başlığı düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.TITLE_TOO_SHORT]: {
    title: "Başlık önerilen minimumdan kısa",
    why: "Kısa başlıklar arama snippet’inde zayıf görünebilir. Bu bir yayın engeli değildir.",
    where: "Makale editöründe SEO başlığını veya görünen başlığı düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.TITLE_TOO_LONG]: {
    title: "Başlık önerilen üst sınırı aşıyor",
    why: "Uzun başlıklar arama sonuçlarında kesilebilir. Bu bir yayın engeli değildir.",
    where: "Makale editöründe SEO başlığını kısalt",
    actionable: true,
  },
  [SEO_FINDING_CODE.SEO_TITLE_MISSING]: {
    title: "SEO başlığı boş",
    why: "Arama ve sosyal başlık görünen makale başlığına düşer. H1 değişmez.",
    where: "Makale editöründe SEO alanını düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.META_DESCRIPTION_MISSING]: {
    title: "Meta açıklaması eksik",
    why: "Search/social snippet kalitesi düşebilir.",
    where: "Makale editöründe SEO alanını düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.META_DESCRIPTION_TOO_SHORT]: {
    title: "Meta açıklaması kısa",
    why: "Kısa açıklamalar arama snippet’inde zayıf kalabilir. Bu bir yayın engeli değildir.",
    where: "Makale editöründe SEO açıklamasını düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.META_DESCRIPTION_TOO_LONG]: {
    title: "Meta açıklaması uzun",
    why: "Uzun açıklamalar arama sonuçlarında kesilebilir. Bu bir yayın engeli değildir.",
    where: "Makale editöründe SEO açıklamasını kısalt",
    actionable: true,
  },
  [SEO_FINDING_CODE.SLUG_INVALID]: {
    title: "Slug geçersiz",
    why: "Güvenilir kanonik URL üretilemiyor.",
    where: "Slug değişikliği mevcut yayın sözleşmesi üzerinden yapılır",
    actionable: true,
  },
  [SEO_FINDING_CODE.CANONICAL_UNTRUSTED_ORIGIN]: {
    title: "Canonical bu sitenin adresi değil",
    why: "Geçersiz override yok sayılır; sistem varsayılan kanonik URL’yi kullanır.",
    where: "Makale editöründe canonical alanını düzelt veya boş bırak",
    actionable: true,
  },
  [SEO_FINDING_CODE.CANONICAL_EDITOR_ORIGIN]: {
    title: "Canonical özel bir editör yoluna işaret ediyor",
    why: "Editör veya API yolları kamuya açık kanonik olamaz.",
    where: "Makale editöründe canonical alanını düzelt veya boş bırak",
    actionable: true,
  },
  [SEO_FINDING_CODE.CANONICAL_QUERY_PARAMS]: {
    title: "Canonical sorgu veya parça içeriyor",
    why: "Kanonik URL sorgu parametresi veya hash taşıyamaz.",
    where: "Makale editöründe canonical alanını düzelt",
    actionable: true,
  },
  [SEO_FINDING_CODE.CANONICAL_OVERRIDE_APPLIED]: {
    title: "Açık canonical override kullanılıyor",
    why: "Varsayılan slug URL’si yerine kayıtlı aynı-köken adresi yayına çıkar.",
    where: "Makale editöründe canonical alanını gözden geçir",
    actionable: true,
  },
  [SEO_FINDING_CODE.CANONICAL_OVERRIDE_REJECTED]: {
    title: "Canonical override geçersiz",
    why: "Kayıtlı değer yok sayıldı; güvenilir varsayılan URL kullanılıyor.",
    where: "Makale editöründe canonical alanını düzelt veya boş bırak",
    actionable: true,
  },
  [SEO_FINDING_CODE.HERO_MISSING]: {
    title: "HERO görseli eksik",
    why: "Sosyal paylaşım ve görsel arama bağlamı zayıf kalır. Bu bir yayın engeli değildir.",
    where: "HERO ilişkisini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.HERO_ALT_MISSING]: {
    title: "HERO alt metni eksik",
    why: "Erişilebilirlik ve görsel bağlam eksik.",
    where: "HERO ilişkisini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.HERO_PUBLIC_URL_MISSING]: {
    title: "HERO genel adresi yok",
    why: "Paylaşım ve yapılandırılmış veri görseli yayınlanamaz.",
    where: "HERO ilişkisini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.HERO_DIMENSIONS_UNKNOWN]: {
    title: "HERO boyutları bilinmiyor",
    why: "Sosyal önizleme kalitesi belirsiz kalabilir. Bu bir yayın engeli değildir.",
    where: "HERO ilişkisini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.HERO_DIMENSIONS_SMALL]: {
    title: "HERO önerilen boyutun altında",
    why: "Küçük görseller sosyal kartlarda zayıf görünebilir. Bu bir yayın engeli değildir.",
    where: "HERO ilişkisini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.HERO_PREFERRED_RENDITION_MISSING]: {
    title: "Tercih edilen HERO türevi yok",
    why: "Sistem yedek görsele düşebilir. Bu bir yayın engeli değildir.",
    where: "HERO ilişkisini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.HERO_LEGACY_RENDITION_FALLBACK]: {
    title: "HERO eski görsele düşüyor",
    why: "Tercih edilen türetilmiş görsel yok; yedek kullanılıyor.",
    where: "HERO ilişkisini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.HERO_RIGHTS_INFORMATIONAL]: {
    title: "HERO hak durumu bilgi amaçlı uyarı",
    why: "Hak uygunluğu kamuya açık görseli etkileyebilir. Bu bir yayın engeli değildir.",
    where: "HERO ilişkisini ve medya haklarını gözden geçir",
    actionable: true,
  },
  [SEO_FINDING_CODE.BODY_EMPTY]: {
    title: "Gövde boş",
    why: "Yayındaki içerikte gövde beklenir.",
    where: "Makale gövdesini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.HEADING_MISSING]: {
    title: "Başlık yapısı zayıf",
    why: "Gövde hiyerarşisi okunabilirliği ve tarama bağlamını etkiler. Bu bir yayın engeli değildir.",
    where: "Makale gövdesini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.AUTHOR_MISSING]: {
    title: "Yazar eksik",
    why: "Haber şeması ve şeffaflık için yazar beklenir.",
    where: "Yazar ilişkisini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.PUBLISHED_AT_MISSING]: {
    title: "Yayın tarihi eksik",
    why: "Yapılandırılmış veri ve haber bağlamı için yayın tarihi gerekir.",
    where: "Yayın durumunu kontrol et",
    actionable: true,
  },
  [SEO_FINDING_CODE.PRIMARY_CATEGORY_MISSING]: {
    title: "Ana kategori eksik",
    why: "Yayınlanabilir sürümde tam olarak bir ana kategori gerekir.",
    where: "Kategori ilişkisini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.STRUCTURED_DATA_SUPPRESSED]: {
    title: "NewsArticle şeması baskılanmış",
    why: "İçerik indekslenemediği için yapılandırılmış veri yayına çıkmaz.",
    where: "İndekslenebilirlik nedenine bak",
    actionable: false,
  },
  [SEO_FINDING_CODE.STRUCTURED_DATA_INCOMPLETE]: {
    title: "NewsArticle önerilen alanları eksik",
    why: "Şema yayına çıkar ama bazı önerilen alanlar boş. Bu bir yayın engeli değildir.",
    where: "SEO, HERO, yazar veya kategori alanlarını tamamla",
    actionable: true,
  },
  [SEO_FINDING_CODE.STRUCTURED_DATA_REQUIRED_MISSING]: {
    title: "NewsArticle zorunlu alanı eksik",
    why: "Eksik zorunlu alanlar yapılandırılmış veriyi zayıflatır.",
    where: "Başlık, URL veya yayın tarihini kontrol et",
    actionable: true,
  },
  [SEO_FINDING_CODE.SOCIAL_METADATA_INCOMPLETE]: {
    title: "Sosyal meta alanları eksik",
    why: "Paylaşım kartı başlık, açıklama veya görselden yoksun kalabilir. Bu bir yayın engeli değildir.",
    where: "SEO alanını ve HERO ilişkisini düzenle",
    actionable: true,
  },
  [SEO_FINDING_CODE.PUBLISHER_NOT_CONFIGURED]: {
    title: "Yayımcı adı yapılandırılmamış",
    why: "NewsArticle yayımcı alanı sistem yapılandırmasına bağlıdır.",
    where: "Sistem yapılandırması; editörden düzeltilmez",
    actionable: false,
  },
  [SEO_FINDING_CODE.ROBOTS_NOINDEX_OVERRIDE]: {
    title: "Editör noindex kısıtı",
    why: "Aksi halde indekslenebilir içerik robots kısıtı nedeniyle noindex olur.",
    where: "Makale editöründe robots kısıtını değiştir",
    actionable: true,
  },
  [SEO_FINDING_CODE.ROBOTS_UNRECOGNIZED]: {
    title: "Robots değeri tanınmıyor",
    why: "Desteklenmeyen metin yok sayılır; yalnızca varsayılan veya noindex geçerlidir.",
    where: "Makale editöründe robots kısıtını varsayılan veya noindex olarak ayarla",
    actionable: true,
  },
  [SEO_FINDING_CODE.SLUG_REDIRECT_COVERAGE]: {
    title: "Eski URL yönlendirmesi kayıtlı",
    why: "Eski slug ziyaretçileri mevcut URL’ye kalıcı olarak yönlendirilir.",
    where: "URL geçmişi salt okunurdur",
    actionable: false,
  },
  [SEO_FINDING_CODE.NOT_INDEXABLE]: {
    title: "İçerik indekslenemez",
    why: "Yayın veya sistem politikası noindex uyguluyor.",
    where: "Yayın durumunu kontrol et",
    actionable: true,
  },
  [SEO_FINDING_CODE.LEGAL_WITHDRAWAL_NOINDEX]: {
    title: "İçerik hukuken geri çekilmiş",
    why: "Sistem noindex uyguluyor.",
    where: "Bu durum kasıtlıdır; SEO alanından override edilemez",
    actionable: false,
  },
};

export function presentSeoFinding(finding: SeoFinding): SeoFindingCopy & {
  code: SeoFindingCode;
  severity: SeoFinding["severity"];
  kind: SeoFinding["kind"];
} {
  return {
    ...FINDING_COPY[finding.code],
    code: finding.code,
    severity: finding.severity,
    kind: finding.kind,
  };
}

export function seoSeverityLabel(severity: SeoFinding["severity"]): string {
  if (severity === SEO_FINDING_SEVERITY.ERROR) {
    return "Kritik";
  }
  if (severity === SEO_FINDING_SEVERITY.WARNING) {
    return "Uyarı";
  }
  return "Bilgi";
}

export function seoKindLabel(kind: SeoFinding["kind"]): string {
  return kind === SEO_FINDING_KIND.TECHNICAL ? "Teknik" : "Editoryal";
}

export function seoHealthLabel(input: {
  errorCount: number;
  warningCount: number;
}): { label: string; tone: "critical" | "warning" | "good" } {
  if (input.errorCount > 0) {
    return { label: "Kritik", tone: "critical" };
  }
  if (input.warningCount > 0) {
    return { label: "Uyarı", tone: "warning" };
  }
  return { label: "İyi", tone: "good" };
}

export function presentIndexability(
  decision: PublicIndexabilityDecision,
): { label: string; detail: string; canEditorOverride: boolean } {
  switch (decision.reason) {
    case PUBLIC_INDEXABILITY_REASON.INDEXABLE:
      return {
        label: "İndekslenebilir",
        detail: "Yayındaki içerik sistem politikasına göre tarama için açık.",
        canEditorOverride: true,
      };
    case PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_NEVER_PUBLISHED:
      return {
        label: "İndekslenemez: içerik yayında değil",
        detail: "Hiç yayınlanmamış içerik kamuya açık indekslenemez.",
        canEditorOverride: false,
      };
    case PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_UNPUBLISHED:
      return {
        label: "İndekslenemez: içerik yayında değil",
        detail: "Yayından kaldırılmış içerik noindex uygulanır.",
        canEditorOverride: false,
      };
    case PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_RETRACTION:
      return {
        label: "İndekslenemez: hukuki kaldırma",
        detail: "Geri çekilmiş içerikte sistem noindex uygular. Editör bunu açamaz.",
        canEditorOverride: false,
      };
    case PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_TAKEDOWN:
      return {
        label: "Hukuki kaldırma",
        detail: "Hukuki kaldırmada sistem noindex uygular. Editör bunu açamaz.",
        canEditorOverride: false,
      };
    case PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_ROBOTS_OVERRIDE:
      return {
        label: "Noindex: editör robots kısıtı",
        detail: "İçerik aksi halde indekslenebilir; kayıtlı noindex kısıtı uygulanıyor.",
        canEditorOverride: true,
      };
    case PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_MISSING_PUBLISHED_VERSION:
      return {
        label: "İndekslenemez: içerik yayında değil",
        detail: "Yayınlanmış sürüm olmadığı için içerik indekslenemez.",
        canEditorOverride: false,
      };
    case PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_DELETED:
    case PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_NOT_FOUND:
    default:
      return {
        label: "İndekslenemez",
        detail: "Sistem politikası noindex uyguluyor. Editör bunu açamaz.",
        canEditorOverride: false,
      };
  }
}

export function presentCanonicalRejection(
  rejection: SeoCanonicalOverrideRejection,
): string {
  switch (rejection) {
    case SEO_CANONICAL_OVERRIDE_REJECTION.CROSS_ORIGIN:
      return "Canonical yalnızca bu sitenin adresi olabilir.";
    case SEO_CANONICAL_OVERRIDE_REJECTION.EDITOR_PATH:
      return "Canonical özel bir editör veya API yoluna işaret edemez.";
    case SEO_CANONICAL_OVERRIDE_REJECTION.QUERY_OR_HASH:
      return "Canonical sorgu parametresi veya parça içeremez.";
    case SEO_CANONICAL_OVERRIDE_REJECTION.CREDENTIALS:
      return "Canonical kullanıcı bilgisi içeremez.";
    case SEO_CANONICAL_OVERRIDE_REJECTION.UNSAFE_SCHEME:
      return "Canonical http veya https olmalıdır.";
    case SEO_CANONICAL_OVERRIDE_REJECTION.INSECURE:
      return "Canonical adresi bu sitenin güvenli kökeniyle uyuşmuyor.";
    case SEO_CANONICAL_OVERRIDE_REJECTION.INVALID:
    default:
      return "Canonical geçerli bir adres değil. Tehlikeli bir adrese sessizce dönüştürülmez.";
  }
}

export function publicationStatusLabel(status: string): string {
  if (status === "PUBLISHED") {
    return "Yayında";
  }
  if (status === "UNPUBLISHED") {
    return "Yayında değil";
  }
  return "Yayında değil";
}

export function legalWithdrawalLabel(kind: string | null | undefined): string | null {
  if (kind === "RETRACTION") {
    return "Geri çekilmiş";
  }
  if (kind === "TAKEDOWN") {
    return "Hukuki kaldırma";
  }
  return null;
}

export function heroStatusLabel(input: {
  missingHero: boolean;
  missingHeroAlt: boolean;
}): { label: string; tone: "critical" | "warning" | "good" } {
  if (input.missingHero) {
    return { label: "HERO yok", tone: "warning" };
  }
  if (input.missingHeroAlt) {
    return { label: "Alt yok", tone: "warning" };
  }
  return { label: "HERO tamam", tone: "good" };
}

export function presentDiscoverReadiness(state: DiscoverReadinessState): {
  label: string;
  detail: string;
  tone: "good" | "warning" | "neutral";
} {
  if (state === DISCOVER_READINESS.READY) {
    return {
      label: "Teknik olarak hazır",
      detail:
        "Teknik Discover hazırlığı karşılandı. Bu bir yerleştirme, tarama veya trafik garantisi değildir.",
      tone: "good",
    };
  }
  if (state === DISCOVER_READINESS.NEEDS_ATTENTION) {
    return {
      label: "Dikkat gerekli",
      detail: "Önerilen alanlar eksik. Discover yerleştirme şansı hesaplanmaz.",
      tone: "warning",
    };
  }
  return {
    label: "Teknik olarak uygun değil",
    detail: "Sayfa Discover teknik uygunluğu için indekslenebilir değil.",
    tone: "neutral",
  };
}

export function presentDiscoverFindingClass(classification: DiscoverFindingClass): string {
  if (classification === DISCOVER_FINDING_CLASS.TECHNICAL_REQUIREMENT) {
    return "Teknik gereksinim";
  }
  if (classification === DISCOVER_FINDING_CLASS.RECOMMENDATION) {
    return "Öneri";
  }
  return "Harici / bilinmiyor";
}

export function presentDiscoverFinding(finding: DiscoverFinding): {
  title: string;
  classification: string;
} {
  return {
    title:
      finding.code === "HERO_TOO_SMALL"
        ? "Kaynak görsel yeterince büyük değil"
        : finding.message,
    classification: presentDiscoverFindingClass(finding.classification),
  };
}

export function canonicalStatusLabel(findingCodes: readonly string[]): string {
  if (findingCodes.includes(SEO_FINDING_CODE.CANONICAL_OVERRIDE_REJECTED)) {
    return "Override geçersiz";
  }
  if (findingCodes.includes(SEO_FINDING_CODE.CANONICAL_OVERRIDE_APPLIED)) {
    return "Açık override";
  }
  return "Varsayılan";
}

const SENSITIVE_SEO_RENDER_PATTERNS = [
  "storageKey",
  "storage_key",
  "internalNote",
  "internal_note",
  "licenseNote",
  "passwordHash",
  "tokenHash",
  "secretCiphertext",
];

export function seoRenderedOutputLeaksSecrets(source: string): boolean {
  return SENSITIVE_SEO_RENDER_PATTERNS.some((pattern) => source.includes(pattern));
}
