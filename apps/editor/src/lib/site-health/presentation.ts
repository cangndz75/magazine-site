import type { SiteHealthDto, SiteHealthStatus } from "@magazine/domain";
import {
  formatDashboardCount,
  formatDashboardDateTime,
  formatDashboardRelative,
} from "@/lib/dashboard/dashboard-presentation";

export const SITE_HEALTH_STATUS_LABEL: Record<SiteHealthStatus, string> = {
  HEALTHY: "Sağlıklı",
  DEGRADED: "Kısmi Sorun",
  ATTENTION: "Dikkat Gerekiyor",
  UNAVAILABLE: "Kullanılamıyor",
};

export type SiteHealthTone = "healthy" | "degraded" | "attention" | "unavailable" | "neutral";

export const SITE_HEALTH_TONE: Record<SiteHealthStatus, SiteHealthTone> = {
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  ATTENTION: "attention",
  UNAVAILABLE: "unavailable",
};

export const SITE_HEALTH_TONE_STYLES: Record<
  SiteHealthTone,
  { badge: string; icon: string; strip: string }
> = {
  healthy: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: "text-emerald-600",
    strip: "border-emerald-200 bg-emerald-50/60",
  },
  degraded: {
    badge: "border-amber-200 bg-amber-50 text-amber-900",
    icon: "text-amber-700",
    strip: "border-amber-200 bg-amber-50/50",
  },
  attention: {
    badge: "border-amber-300 bg-amber-50 text-amber-950",
    icon: "text-amber-800",
    strip: "border-amber-300 bg-amber-50/80",
  },
  unavailable: {
    badge: "border-zinc-300 bg-zinc-100 text-zinc-700",
    icon: "text-zinc-500",
    strip: "border-zinc-200 bg-zinc-50",
  },
  neutral: {
    badge: "border-zinc-200 bg-white text-zinc-700",
    icon: "text-zinc-500",
    strip: "border-zinc-200 bg-white",
  },
};

export function siteHealthStatusLabel(status: SiteHealthStatus): string {
  return SITE_HEALTH_STATUS_LABEL[status];
}

export function siteHealthTone(status: SiteHealthStatus): SiteHealthTone {
  return SITE_HEALTH_TONE[status];
}

export function formatSiteHealthTimestamp(
  value: string | null,
  now: Date = new Date(),
): string {
  if (!value) {
    return "—";
  }
  return formatDashboardRelative(value, now);
}

export function formatSiteHealthDateTime(value: string | null): string {
  return formatDashboardDateTime(value);
}

export function formatSiteHealthCount(value: number | null): string {
  if (value === null) {
    return "—";
  }
  return formatDashboardCount(value);
}

export type SummaryStripItem = {
  key: string;
  label: string;
  status: SiteHealthStatus;
  context: string;
};

export function buildSummaryStrip(health: SiteHealthDto, now: Date = new Date()): SummaryStripItem[] {
  const db = health.database;
  const outbox = health.outbox;
  const scheduled = health.scheduledPublishing;
  const analytics = health.analytics;
  const seo = health.seo;
  const homepage = health.homepage;
  const media = health.media;
  const cache = health.cache;

  return [
    {
      key: "database",
      label: "Veritabanı",
      status: db.status,
      context:
        db.availability === "UNAVAILABLE"
          ? "Bağlantı okunamadı"
          : db.metrics.available
            ? "Bağlantı kullanılabilir"
            : "Bağlantı yok",
    },
    {
      key: "outbox",
      label: "İş Kuyruğu",
      status: outbox.status,
      context:
        outbox.metrics.pending === null
          ? "Sinyal yok"
          : `${formatSiteHealthCount(outbox.metrics.pending)} bekliyor · ${formatSiteHealthCount(outbox.metrics.dead)} başarısız`,
    },
    {
      key: "scheduledPublishing",
      label: "Zamanlanmış Yayınlar",
      status: scheduled.status,
      context:
        scheduled.metrics.scheduledCount === null
          ? "Sinyal yok"
          : scheduled.metrics.scheduledCount === 0
            ? "Planlanmış yayın yok"
            : scheduled.metrics.overdueCount && scheduled.metrics.overdueCount > 0
              ? `${formatSiteHealthCount(scheduled.metrics.overdueCount)} gecikmiş`
              : scheduled.metrics.nextScheduledAt
                ? `Sıradaki ${formatSiteHealthTimestamp(scheduled.metrics.nextScheduledAt, now)}`
                : `${formatSiteHealthCount(scheduled.metrics.scheduledCount)} planlı`,
    },
    {
      key: "analytics",
      label: "Analytics",
      status: analytics.status,
      context:
        analytics.metrics.availability === "UNAVAILABLE"
          ? "Veri kullanılamıyor"
          : analytics.metrics.lastCompletedAt
            ? `Son aggregate ${formatSiteHealthTimestamp(analytics.metrics.lastCompletedAt, now)}`
            : analytics.metrics.lastSuccessfulThrough
              ? `Son veri ${formatSiteHealthTimestamp(analytics.metrics.lastSuccessfulThrough, now)}`
              : "Tazelik okunuyor",
    },
    {
      key: "seo",
      label: "SEO",
      status: seo.status,
      context:
        seo.metrics.critical === null
          ? "Sinyal yok"
          : seo.metrics.critical > 0
            ? `${formatSiteHealthCount(seo.metrics.critical)} kritik`
            : seo.metrics.attention && seo.metrics.attention > 0
              ? `${formatSiteHealthCount(seo.metrics.attention)} dikkat`
              : "Denetim temiz",
    },
    {
      key: "homepage",
      label: "Ana Sayfa",
      status: homepage.status,
      context:
        homepage.metrics.liveVersionAvailable === null
          ? "Sinyal yok"
          : homepage.metrics.liveVersionAvailable
            ? `${formatSiteHealthCount(homepage.metrics.publishedSlotCount)} canlı slot`
            : "Yayınlanmış sürüm yok",
    },
    {
      key: "media",
      label: "Medya",
      status: media.status,
      context:
        media.metrics.rightsIneligible === null
          ? "Sinyal yok"
          : media.metrics.rightsIneligible > 0
            ? `${formatSiteHealthCount(media.metrics.rightsIneligible)} hak engeli`
            : "Hak özeti temiz",
    },
    {
      key: "cache",
      label: "Cache / Invalidation",
      status: cache.status,
      context: cache.metrics.runtimeObservable
        ? "Runtime gözlemleniyor"
        : cache.metrics.dead && cache.metrics.dead > 0
          ? `${formatSiteHealthCount(cache.metrics.dead)} başarısız invalidation`
          : "Runtime gözlemlenemiyor",
    },
  ];
}

export const ACTION_LINK_LABEL: Record<string, string> = {
  "/calendar": "Takvime Git →",
  "/analytics": "İncele →",
  "/seo": "İncele →",
  "/homepage": "Yönet →",
};

export function actionLinkLabel(href: string | null): string | null {
  if (!href) {
    return null;
  }
  if (href.startsWith("/media")) {
    return "Yönet →";
  }
  return ACTION_LINK_LABEL[href] ?? "İncele →";
}
