import {
  ANALYTICS_CONTENT_SORT,
  ANALYTICS_METRIC_AVAILABILITY_REASON,
  ANALYTICS_PLACEMENT,
  ANALYTICS_REPORTING_METRIC,
  ANALYTICS_REPORTING_RANGE,
  ANALYTICS_REPORTING_TIMEZONE,
  reportingCalendarDate,
  type AnalyticsContentSort,
  type AnalyticsPlacement,
  type AnalyticsReportingMetric,
  type AnalyticsTrafficSource,
} from "@magazine/domain";
import type { AnalyticsFreshnessDto, AnalyticsMetricAvailabilityDto } from "./types";

export const ANALYTICS_REPORTING_TIMEZONE_LABEL = "Saat dilimi: Europe/Istanbul";

export { ANALYTICS_REPORTING_TIMEZONE };

/** Metrics selectable on the primary time-series chart, in display order. */
export const ANALYTICS_CHART_METRICS: readonly AnalyticsReportingMetric[] = [
  ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS,
  ANALYTICS_REPORTING_METRIC.HOMEPAGE_IMPRESSIONS,
  ANALYTICS_REPORTING_METRIC.HOMEPAGE_CLICKS,
  ANALYTICS_REPORTING_METRIC.GALLERY_OPENS,
  ANALYTICS_REPORTING_METRIC.GALLERY_IMAGE_VIEWS,
  ANALYTICS_REPORTING_METRIC.VIDEO_IMPRESSIONS,
];

export const ANALYTICS_METRIC_LABEL: Record<AnalyticsReportingMetric, string> = {
  ARTICLE_VIEWS: "Makale Görüntüleme",
  HOMEPAGE_IMPRESSIONS: "Anasayfa Gösterim",
  HOMEPAGE_CLICKS: "Anasayfa Tıklama",
  HOMEPAGE_CTR: "Anasayfa CTR",
  GALLERY_OPENS: "Galeri Açılışı",
  GALLERY_IMAGE_VIEWS: "Galeri Görsel Görüntüleme",
  VIDEO_IMPRESSIONS: "Video Gösterim",
};

export const ANALYTICS_CONTENT_SORT_LABEL: Record<AnalyticsContentSort, string> = {
  [ANALYTICS_CONTENT_SORT.ARTICLE_VIEWS]: "Görüntüleme",
  [ANALYTICS_CONTENT_SORT.HOMEPAGE_CLICKS]: "Tıklama",
  [ANALYTICS_CONTENT_SORT.HOMEPAGE_CTR]: "CTR",
};

export const ANALYTICS_SOURCE_LABEL: Record<AnalyticsTrafficSource, string> = {
  DIRECT: "Doğrudan",
  SEARCH: "Arama",
  SOCIAL: "Sosyal",
  INTERNAL: "Site İçi",
  REFERRAL: "Yönlendirme",
  UNKNOWN: "Bilinmiyor",
};

/** Homepage-report placement labels. Editorial slots reuse the Homepage Builder's own labels. */
export const ANALYTICS_PLACEMENT_LABEL: Record<AnalyticsPlacement, string> = {
  LEAD: "Lead",
  SUPPORT_1: "Destek 1",
  SUPPORT_2: "Destek 2",
  FEATURED_1: "Öne Çıkan 1",
  FEATURED_2: "Öne Çıkan 2",
  FEATURED_3: "Öne Çıkan 3",
  FEATURED_4: "Öne Çıkan 4",
  FEATURED_5: "Öne Çıkan 5",
  CONVERSATION: "Sohbet Şeridi",
  RECENCY_FALLBACK: "Otomatik Güncel Akış",
  HOMEPAGE_VIDEO: "Anasayfa Videosu",
  ARTICLE_GALLERY: "Makale Galerisi",
  ARTICLE_VIDEO: "Makale Videosu",
  ARTICLE_BODY: "Makale İçeriği",
};

/** True only for placements the Homepage Builder editorially authored. */
export function isEditorialPlacement(placement: AnalyticsPlacement): boolean {
  return placement !== ANALYTICS_PLACEMENT.RECENCY_FALLBACK;
}

const NUMBER_FORMAT = new Intl.NumberFormat("tr-TR");
const PERCENT_FORMAT = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const TIME_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ANALYTICS_REPORTING_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const DAY_LABEL_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ANALYTICS_REPORTING_TIMEZONE,
  day: "2-digit",
  month: "short",
});
const HOUR_LABEL_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  timeZone: ANALYTICS_REPORTING_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

export function formatAnalyticsCount(value: number): string {
  return NUMBER_FORMAT.format(value);
}

/** clicks/impressions ratio → percentage string, or an em dash when impressions are zero. */
export function formatAnalyticsCtr(ctr: number | null): string {
  if (ctr === null) {
    return "—";
  }
  return `%${PERCENT_FORMAT.format(ctr * 100)}`;
}

export function isAnomalousCtr(ctr: number | null): boolean {
  return ctr !== null && ctr > 1;
}

export function formatAnalyticsDelta(
  comparison: { delta: number; percentageChange: number | null } | null,
): { label: string; direction: "up" | "down" | "flat" | "new" } | null {
  if (!comparison) {
    return null;
  }
  if (comparison.percentageChange === null) {
    if (comparison.delta > 0) {
      return { label: "Yeni", direction: "new" };
    }
    return { label: "—", direction: "flat" };
  }
  const pct = comparison.percentageChange * 100;
  const rounded = PERCENT_FORMAT.format(Math.abs(pct));
  if (pct > 0) {
    return { label: `+%${rounded}`, direction: "up" };
  }
  if (pct < 0) {
    return { label: `-%${rounded}`, direction: "down" };
  }
  return { label: "%0", direction: "flat" };
}

export function formatAnalyticsTime(value: Date): string {
  return TIME_FORMAT.format(value);
}

export function formatAnalyticsDayLabel(value: Date): string {
  return DAY_LABEL_FORMAT.format(value);
}

export function formatAnalyticsHourLabel(value: Date): string {
  return HOUR_LABEL_FORMAT.format(value);
}

export function analyticsTodayCalendarDate(now: Date = new Date()): string {
  return reportingCalendarDate(now, ANALYTICS_REPORTING_TIMEZONE);
}

export type AnalyticsFreshnessPresentation = {
  label: string;
  tone: "ok" | "pending" | "failed";
};

export function presentAnalyticsFreshness(
  freshness: AnalyticsFreshnessDto,
): AnalyticsFreshnessPresentation {
  if (freshness.status === "AVAILABLE") {
    return {
      label: `Son güncelleme: ${formatAnalyticsTime(new Date(freshness.lastCompletedAt))}`,
      tone: "ok",
    };
  }
  if (freshness.reason === "AGGREGATION_FAILED") {
    return { label: "Rapor verileri şu anda hazırlanamadı.", tone: "failed" };
  }
  return { label: "Veriler hazırlanıyor.", tone: "pending" };
}

const METRIC_AVAILABILITY_REASON_LABEL: Record<string, string> = {
  [ANALYTICS_METRIC_AVAILABILITY_REASON.MEASUREMENT_NOT_ENABLED]: "Bu ölçüm henüz etkin değil.",
  [ANALYTICS_METRIC_AVAILABILITY_REASON.CONSENT_INTEGRATION_PENDING]:
    "Onay entegrasyonu tamamlanana kadar bu ölçüm etkin değil.",
  [ANALYTICS_METRIC_AVAILABILITY_REASON.VIDEO_PLAY_DEFERRED]:
    "Video oynatma ölçümü henüz devrede değil.",
  [ANALYTICS_METRIC_AVAILABILITY_REASON.DURABLE_VISITOR_ID_DISABLED]:
    "Kalıcı ziyaretçi kimliği bu sürümde devre dışı.",
  [ANALYTICS_METRIC_AVAILABILITY_REASON.AGGREGATION_PENDING]: "Veriler işleniyor.",
  [ANALYTICS_METRIC_AVAILABILITY_REASON.AGGREGATION_FAILED]:
    "Rapor verileri şu anda hazırlanamadı.",
};

export function presentMetricAvailability(
  availability: AnalyticsMetricAvailabilityDto,
): string | null {
  if (availability.status === "AVAILABLE") {
    return null;
  }
  return METRIC_AVAILABILITY_REASON_LABEL[availability.reason] ?? "Bu ölçüm henüz etkin değil.";
}

export const ANALYTICS_CTR_MIN_IMPRESSIONS_NOTE = `CTR sıralaması yalnızca en az ${ANALYTICS_REPORTING_RANGE.DEFAULT_CTR_MIN_IMPRESSIONS} gösterim alan içerikleri dikkate alır.`;

export const ANALYTICS_AUTHOR_CREDIT_NOTE =
  "Birden fazla yazarlı içerikte görüntüleme her yazara tam krediyle yansıtılır.";
