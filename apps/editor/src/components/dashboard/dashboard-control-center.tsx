import Link from "next/link";
import type { ReactNode } from "react";
import type { SuperAdminDashboardDto } from "@magazine/db/editor";
import {
  ANALYTICS_PLACEMENT_LABEL,
  ANALYTICS_SOURCE_LABEL,
  formatAnalyticsCount,
  formatAnalyticsCtr,
  formatAnalyticsDelta,
} from "@/lib/analytics/presentation";
import type { AnalyticsComparisonDto } from "@/lib/analytics/types";
import {
  attentionSignalLabel,
  formatDashboardCount,
  formatDashboardDateTime,
  formatDashboardDay,
  formatDashboardRelative,
  formatDashboardTime,
  legalActionLabel,
} from "@/lib/dashboard/dashboard-presentation";

type AnalyticsData = Extract<
  SuperAdminDashboardDto["analytics"],
  { status: "AVAILABLE" }
>["data"];

const COMPACT_CARD =
  "border border-zinc-200 bg-white shadow-[0_1px_0_rgba(24,24,27,0.03)]";
const CARD_HEADER =
  "flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2";
const CARD_TITLE =
  "text-[11px] font-semibold uppercase tracking-wide text-zinc-500";

const PERIOD_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  timeZone: "Europe/Istanbul",
});

function periodLabel(data: AnalyticsData | null): string {
  if (!data) {
    return "Son 7 Gün";
  }
  const from = PERIOD_FORMAT.format(new Date(data.period.fromInclusive));
  const to = PERIOD_FORMAT.format(
    new Date(new Date(data.period.toExclusive).getTime() - 1),
  );
  return `${from} - ${to}`;
}

function sourceLabel(source: string): string {
  return (
    ANALYTICS_SOURCE_LABEL[source as keyof typeof ANALYTICS_SOURCE_LABEL] ??
    source
  );
}

function placementLabel(placement: string): string {
  return (
    ANALYTICS_PLACEMENT_LABEL[
      placement as keyof typeof ANALYTICS_PLACEMENT_LABEL
    ] ?? placement
  );
}

function pct(value: number | null): string {
  if (value === null) {
    return "-";
  }
  return `%${new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value * 100)}`;
}

function progressWidth(value: number | null): string {
  if (value === null) {
    return "0%";
  }
  return `${Math.max(3, Math.min(100, value * 100))}%`;
}

function Section({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${COMPACT_CARD} ${className}`}>
      <div className={CARD_HEADER}>
        <h2 className={CARD_TITLE}>{title}</h2>
        {action ? (
          <Link
            href={action.href}
            className="text-[11px] font-semibold text-pink-700 hover:text-pink-800"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      <div className="px-3 py-2.5">{children}</div>
    </section>
  );
}

function Unavailable({ label = "Analytics verisi şu anda kullanılamıyor." }) {
  return (
    <p className="py-3 text-sm leading-relaxed text-zinc-500" role="status">
      {label}
    </p>
  );
}

function DashboardHeader({
  generatedAt,
  analytics,
}: {
  generatedAt: string;
  analytics: AnalyticsData | null;
}) {
  return (
    <header className="mb-3 flex flex-col gap-2 border-b border-zinc-200 pb-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">
          Kontrol Merkezi
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
          Yayın, performans, ekip ve operasyon durumunu tek görünümden takip
          edin.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span className="border border-zinc-200 bg-white px-2.5 py-1 font-medium text-zinc-700">
          {periodLabel(analytics)}
        </span>
        <span>Güncellendi: {formatDashboardDateTime(generatedAt)}</span>
      </div>
    </header>
  );
}

function KpiStrip({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  const analytics =
    dashboard.analytics.status === "AVAILABLE" ? dashboard.analytics.data : null;
  const editorial =
    dashboard.editorial.status === "AVAILABLE" ? dashboard.editorial.data : null;
  const attention =
    dashboard.attention.status === "AVAILABLE" ? dashboard.attention.data : null;
  const comparison = analytics?.comparison as {
    articleViews: AnalyticsComparisonDto;
    homepageClicks: AnalyticsComparisonDto;
  } | null;
  const viewsDelta = formatAnalyticsDelta(comparison?.articleViews ?? null);
  const clicksDelta = formatAnalyticsDelta(comparison?.homepageClicks ?? null);
  const items = [
    {
      label: "Sayfa Görüntüleme",
      value: analytics ? formatAnalyticsCount(analytics.metrics.articleViews) : null,
      note: viewsDelta?.label ?? "Son 7 gün",
      tone: viewsDelta?.direction,
    },
    {
      label: "Ana Sayfa Gösterim",
      value: analytics
        ? formatAnalyticsCount(analytics.metrics.homepageImpressions)
        : null,
      note: "Yerleşim görünürlüğü",
    },
    {
      label: "Ana Sayfa Tıklama",
      value: analytics
        ? formatAnalyticsCount(analytics.metrics.homepageClicks)
        : null,
      note: clicksDelta?.label ?? formatAnalyticsCtr(analytics?.metrics.homepageCtr ?? null),
      tone: clicksDelta?.direction,
    },
    {
      label: "Yayındaki İçerik",
      value: editorial ? formatDashboardCount(editorial.published) : null,
      note: "Canlı yayın havuzu",
    },
    {
      label: "İnceleme Bekleyen",
      value: editorial ? formatDashboardCount(editorial.inReview) : null,
      note: "Editoryal akış",
    },
    {
      label: "Planlanmış Yayın",
      value: editorial ? formatDashboardCount(editorial.scheduled) : null,
      note: "Takvimde",
    },
    {
      label: "Dikkat Gerektiren",
      value: attention ? formatDashboardCount(attention.total) : null,
      note: "Operasyon sinyali",
    },
  ];

  return (
    <div
      role="list"
      aria-label="Kontrol merkezi metrikleri"
      className="mb-3 grid grid-cols-2 border border-zinc-200 bg-white md:grid-cols-4 xl:grid-cols-7"
    >
      {items.map((item) => (
        <div
          key={item.label}
          role="listitem"
          className="min-w-0 border-b border-r border-zinc-100 px-3 py-2 last:border-r-0 xl:border-b-0"
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            {item.label}
          </p>
          {item.value ? (
            <>
              <p className="mt-1 text-[1.35rem] font-semibold leading-none tabular-nums text-zinc-950">
                {item.value}
              </p>
              <p
                className={`mt-1 truncate text-[11px] ${
                  item.tone === "up" || item.tone === "new"
                    ? "text-emerald-700"
                    : item.tone === "down"
                      ? "text-rose-700"
                      : "text-zinc-500"
                }`}
              >
                {item.note}
              </p>
            </>
          ) : (
            <p className="mt-2 text-xs font-medium text-zinc-400">
              Kullanılamıyor
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function TrafficChart({ analytics }: { analytics: AnalyticsData | null }) {
  if (!analytics) {
    return (
      <Section title="Trafik Görünümü" action={{ href: "/analytics", label: "Analytics" }}>
        <Unavailable />
      </Section>
    );
  }
  const points = analytics.timeSeries;
  const max = Math.max(
    1,
    ...points.flatMap((point) => [
      point.articleViews,
      point.homepageImpressions,
    ]),
  );
  const width = 680;
  const height = 210;
  const padX = 32;
  const padY = 18;
  const x = (index: number) =>
    padX + (index * (width - padX * 2)) / Math.max(1, points.length - 1);
  const y = (value: number) =>
    height - padY - (value / max) * (height - padY * 2);
  const pathFor = (key: "articleViews" | "homepageImpressions") =>
    points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[key])}`)
      .join(" ");

  return (
    <Section title="Trafik Görünümü" action={{ href: "/analytics", label: "Detay" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[1.55rem] font-semibold leading-none tabular-nums text-zinc-950">
            {formatAnalyticsCount(analytics.metrics.articleViews)}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Son 7 günde makale görüntüleme
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 bg-pink-600" />
            Sayfa görüntüleme
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 bg-indigo-500" />
            Ana sayfa gösterim
          </span>
        </div>
      </div>
      <div className="mt-2 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Son 7 günlük trafik çizgi grafiği"
          className="h-[210px] w-full"
          preserveAspectRatio="none"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <line
              key={tick}
              x1={padX}
              x2={width - padX}
              y1={y(max * tick)}
              y2={y(max * tick)}
              stroke="#e4e4e7"
              strokeWidth="1"
            />
          ))}
          <path
            d={pathFor("homepageImpressions")}
            fill="none"
            stroke="#6366f1"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d={pathFor("articleViews")}
            fill="none"
            stroke="#db2777"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {points.map((point, index) => (
            <g key={point.bucketStart}>
              <circle cx={x(index)} cy={y(point.articleViews)} r="3.5" fill="#db2777" />
              <text
                x={x(index)}
                y={height - 2}
                textAnchor="middle"
                className="fill-zinc-500 text-[10px]"
              >
                {formatDashboardDay(point.bucketStart)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </Section>
  );
}

function TopContent({ analytics }: { analytics: AnalyticsData | null }) {
  return (
    <Section
      title="En İyi Performans Gösteren İçerikler"
      action={{ href: "/analytics/content", label: "Liste" }}
    >
      {!analytics ? (
        <Unavailable />
      ) : (
        <ol className="space-y-2">
          {analytics.topContent.map((item, index) => (
            <li
              key={item.contentItemId}
              className="grid grid-cols-[2rem_1fr] gap-2 border-b border-zinc-100 pb-2 last:border-0 last:pb-0"
            >
              <span className="text-sm font-semibold tabular-nums text-zinc-400">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <Link
                  href={item.targetHref}
                  className="line-clamp-2 text-sm font-semibold leading-5 text-zinc-950 hover:text-pink-700"
                >
                  {item.title}
                </Link>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-zinc-500">
                  <span>{item.primaryCategoryName ?? "Kategori yok"}</span>
                  <span>{formatAnalyticsCount(item.articleViews)} görüntülenme</span>
                  <span>{formatAnalyticsCount(item.homepageClicks)} tıklama</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function TrafficSources({ analytics }: { analytics: AnalyticsData | null }) {
  return (
    <Section title="Trafik Kaynakları">
      {!analytics ? (
        <Unavailable />
      ) : (
        <div className="space-y-2">
          {analytics.trafficSources.map((source) => (
            <div key={source.sourceChannel}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-zinc-700">
                  {sourceLabel(source.sourceChannel)}
                </span>
                <span className="tabular-nums text-zinc-500">
                  {formatAnalyticsCount(source.eventCount)} · {pct(source.share)}
                </span>
              </div>
              <div className="mt-1 h-1.5 bg-zinc-100">
                <div className="h-full bg-zinc-700" style={{ width: progressWidth(source.share) }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function CategoryPerformance({ analytics }: { analytics: AnalyticsData | null }) {
  return (
    <Section title="Kategori Performansı">
      {!analytics ? (
        <Unavailable />
      ) : (
        <div className="space-y-2">
          {analytics.categories.map((category) => (
            <div key={category.categoryId}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-zinc-700">
                  {category.name ?? "Kategori"}
                </span>
                <span className="tabular-nums text-zinc-500">
                  {formatAnalyticsCount(category.articleViews)}
                </span>
              </div>
              <div className="mt-1 h-1.5 bg-zinc-100">
                <div className="h-full bg-pink-600" style={{ width: progressWidth(category.share) }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function AuthorPerformance({ analytics }: { analytics: AnalyticsData | null }) {
  return (
    <Section title="Yazar Performansı">
      {!analytics ? (
        <Unavailable />
      ) : (
        <div className="space-y-2">
          {analytics.authors.map((author) => (
            <div key={author.authorId} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-zinc-100 text-[11px] font-semibold text-zinc-700">
                  {(author.displayName ?? "Y").slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-zinc-800">
                    {author.displayName ?? "Yazar"}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {formatDashboardCount(author.contentCount)} içerik
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold tabular-nums text-zinc-950">
                {formatAnalyticsCount(author.articleViews)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function HomepageOperations({
  dashboard,
  analytics,
}: {
  dashboard: SuperAdminDashboardDto;
  analytics: AnalyticsData | null;
}) {
  const homepage =
    dashboard.homepage.status === "AVAILABLE" ? dashboard.homepage.data : null;
  return (
    <Section title="Ana Sayfa Durumu" action={{ href: "/homepage", label: "Yönet" }}>
      {!homepage ? (
        <Unavailable label="Ana sayfa durumu şu anda okunamıyor." />
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-[11px] text-zinc-500">Canlı slot</p>
              <p className="font-semibold text-zinc-950">
                {formatDashboardCount(homepage.publishedSlotCount)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Taslak slot</p>
              <p className="font-semibold text-zinc-950">
                {formatDashboardCount(homepage.draftSlotCount)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Son yayın</p>
              <p className="truncate font-semibold text-zinc-950">
                {homepage.lastPublishedAt
                  ? formatDashboardDay(homepage.lastPublishedAt)
                  : "-"}
              </p>
            </div>
          </div>
          {analytics?.homepageSlots.length ? (
            <div className="space-y-1.5 border-t border-zinc-100 pt-2">
              {analytics.homepageSlots.slice(0, 3).map((slot) => (
                <div
                  key={`${slot.placement}-${slot.position}`}
                  className="flex items-center justify-between gap-2 text-[11px]"
                >
                  <span className="truncate text-zinc-600">
                    {placementLabel(slot.placement)}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-500">
                    {formatAnalyticsCount(slot.impressions)} / {formatAnalyticsCtr(slot.ctr)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </Section>
  );
}

function EditorialStatus({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  const data =
    dashboard.editorial.status === "AVAILABLE" ? dashboard.editorial.data : null;
  if (!data) {
    return (
      <Section title="İçerik Durumu">
        <Unavailable label="İçerik durumu şu anda okunamıyor." />
      </Section>
    );
  }
  const rows = [
    ["Taslak", data.draft, "bg-zinc-400"],
    ["İncelemede", data.inReview, "bg-amber-500"],
    ["Onaylandı", data.approved, "bg-indigo-500"],
    ["Planlandı", data.scheduled, "bg-sky-500"],
    ["Yayında", data.published, "bg-emerald-600"],
  ] as const;
  const total = Math.max(1, rows.reduce((sum, row) => sum + row[1], 0));
  return (
    <Section title="İçerik Durumu">
      <div className="flex h-2 overflow-hidden bg-zinc-100">
        {rows.map(([label, value, color]) => (
          <div
            key={label}
            className={color}
            style={{ width: `${Math.max(value > 0 ? 4 : 0, (value / total) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {rows.map(([label, value]) => (
          <div key={label} className="border border-zinc-100 px-2 py-1.5">
            <p className="text-[11px] text-zinc-500">{label}</p>
            <p className="text-lg font-semibold leading-none tabular-nums text-zinc-950">
              {formatDashboardCount(value)}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function AttentionCenter({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  const data =
    dashboard.attention.status === "AVAILABLE" ? dashboard.attention.data : null;
  return (
    <Section title="Dikkat Gerektirenler">
      {!data ? (
        <Unavailable label="Dikkat sinyalleri şu anda okunamıyor." />
      ) : data.items.length === 0 ? (
        <p className="py-2 text-sm text-zinc-500">Açık kritik sinyal yok.</p>
      ) : (
        <div className="space-y-2">
          {data.items.slice(0, 5).map((item) => (
            <Link
              key={`${item.contentItemId}-${item.signal}`}
              href={item.targetHref}
              className="block border-b border-zinc-100 pb-2 last:border-0 last:pb-0 hover:text-pink-700"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                  {attentionSignalLabel(item.signal)}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {formatDashboardRelative(item.eventAt)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-sm font-medium text-zinc-900">
                {item.title}
              </p>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

function UpcomingPublishing({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  const data =
    dashboard.upcomingPublishing.status === "AVAILABLE"
      ? dashboard.upcomingPublishing.data
      : null;
  return (
    <Section title="Yaklaşan Yayınlar">
      {!data ? (
        <Unavailable label="Yayın takvimi şu anda okunamıyor." />
      ) : data.items.length === 0 ? (
        <p className="py-2 text-sm text-zinc-500">Planlanmış yayın yok.</p>
      ) : (
        <div className="space-y-2">
          {data.items.slice(0, 5).map((item) => (
            <Link
              key={item.contentItemId}
              href={item.targetHref}
              className="grid grid-cols-[3.25rem_1fr] gap-3 border-b border-zinc-100 pb-2 last:border-0 last:pb-0 hover:text-pink-700"
            >
              <div className="text-xs">
                <p className="font-semibold tabular-nums text-zinc-950">
                  {formatDashboardTime(item.scheduledAt)}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {formatDashboardDay(item.scheduledAt)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-medium text-zinc-900">
                  {item.title}
                </p>
                <p className="text-[11px] text-zinc-500">
                  {item.primaryCategory?.name ?? "Kategori yok"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}

function ReviewOperations({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  const review = dashboard.review.status === "AVAILABLE" ? dashboard.review.data : null;
  const editorial =
    dashboard.editorial.status === "AVAILABLE" ? dashboard.editorial.data : null;
  return (
    <Section title="İnceleme Akışı" action={{ href: "/review", label: "İnceleme" }}>
      {!review ? (
        <Unavailable label="İnceleme akışı şu anda okunamıyor." />
      ) : (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-[11px] text-zinc-500">Bekleyen</p>
            <p className="text-lg font-semibold tabular-nums text-zinc-950">
              {formatDashboardCount(review.count)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Değişiklik</p>
            <p className="text-lg font-semibold tabular-nums text-zinc-950">
              {formatDashboardCount(review.changesRequested)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Onaylı</p>
            <p className="text-lg font-semibold tabular-nums text-zinc-950">
              {formatDashboardCount(editorial?.approved ?? 0)}
            </p>
          </div>
        </div>
      )}
    </Section>
  );
}

function LegalOps({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  const legal = dashboard.legal.status === "AVAILABLE" ? dashboard.legal.data : null;
  return (
    <Section title="Yasal" action={{ href: "/legal", label: "Yasal" }}>
      {!legal ? (
        <Unavailable label="Yasal durum şu anda okunamıyor." />
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-[11px] text-zinc-500">Bekletme</p>
              <p className="font-semibold tabular-nums text-zinc-950">
                {formatDashboardCount(legal.activeHolds)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Kaldırma</p>
              <p className="font-semibold tabular-nums text-zinc-950">
                {formatDashboardCount(legal.activeTakedowns)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-zinc-500">Düzeltme</p>
              <p className="font-semibold tabular-nums text-zinc-950">
                {formatDashboardCount(legal.corrections)}
              </p>
            </div>
          </div>
          {legal.recentActions[0] ? (
            <p className="border-t border-zinc-100 pt-2 text-[11px] text-zinc-500">
              Son işlem: {legalActionLabel(legal.recentActions[0].actionType)}
            </p>
          ) : null}
        </div>
      )}
    </Section>
  );
}

function StaffSecurity({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  const staff =
    dashboard.staffSecurity.status === "AVAILABLE"
      ? dashboard.staffSecurity.data
      : null;
  return (
    <Section title="Ekip & Güvenlik" action={{ href: "/staff", label: "Personel" }}>
      {!staff ? (
        <Unavailable label="Ekip durumu şu anda okunamıyor." />
      ) : (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[11px] text-zinc-500">Aktif personel</p>
            <p className="text-lg font-semibold tabular-nums text-zinc-950">
              {formatDashboardCount(staff.active)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">MFA kapsamı</p>
            <p className="text-lg font-semibold tabular-nums text-zinc-950">
              {staff.total > 0 ? pct(staff.mfaConfigured / staff.total) : "-"}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Devre dışı</p>
            <p className="font-semibold tabular-nums text-zinc-950">
              {formatDashboardCount(staff.disabled)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-zinc-500">Süper Admin</p>
            <p className="font-semibold tabular-nums text-zinc-950">
              {formatDashboardCount(staff.superAdmin)}
            </p>
          </div>
        </div>
      )}
    </Section>
  );
}

function SystemHealth({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  const seo = dashboard.seo.status === "AVAILABLE" ? dashboard.seo.data : null;
  const system =
    dashboard.systemSignals.status === "AVAILABLE"
      ? dashboard.systemSignals.data
      : null;
  const homepage =
    dashboard.homepage.status === "AVAILABLE" ? dashboard.homepage.data : null;
  const rows = [
    {
      label: "SEO",
      status: seo
        ? seo.errorCount > 0
          ? "Dikkat"
          : "Sağlıklı"
        : "Kullanılamıyor",
    },
    {
      label: "Analytics",
      status:
        system?.analyticsFreshness &&
        typeof system.analyticsFreshness === "object" &&
        "status" in system.analyticsFreshness &&
        system.analyticsFreshness.status === "AVAILABLE"
          ? "Sağlıklı"
          : "Kullanılamıyor",
    },
    {
      label: "Homepage",
      status: homepage?.liveVersionId ? "Sağlıklı" : "Dikkat",
    },
    {
      label: "Outbox",
      status: system
        ? system.publicCacheOutbox.dead > 0
          ? "Dikkat"
          : "Sağlıklı"
        : "Kullanılamıyor",
    },
    {
      label: "Media",
      status: seo && seo.missingHeroCount > 0 ? "Dikkat" : "Sağlıklı",
    },
  ];
  return (
    <Section title="Sistem & Yayın Sağlığı">
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-zinc-600">{row.label}</span>
            <span
              className={`font-semibold ${
                row.status === "Sağlıklı"
                  ? "text-emerald-700"
                  : row.status === "Dikkat"
                    ? "text-amber-700"
                    : "text-zinc-400"
              }`}
            >
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function DashboardControlCenter({
  dashboard,
}: {
  dashboard: SuperAdminDashboardDto;
}) {
  const analytics =
    dashboard.analytics.status === "AVAILABLE" ? dashboard.analytics.data : null;

  return (
    <div className="mx-auto max-w-[104rem] px-3 py-3 sm:px-4 lg:px-5">
      <DashboardHeader generatedAt={dashboard.generatedAt} analytics={analytics} />
      <KpiStrip dashboard={dashboard} />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,0.85fr)]">
        <TrafficChart analytics={analytics} />
        <TopContent analytics={analytics} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TrafficSources analytics={analytics} />
        <CategoryPerformance analytics={analytics} />
        <AuthorPerformance analytics={analytics} />
        <HomepageOperations dashboard={dashboard} analytics={analytics} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
        <EditorialStatus dashboard={dashboard} />
        <AttentionCenter dashboard={dashboard} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <UpcomingPublishing dashboard={dashboard} />
        <ReviewOperations dashboard={dashboard} />
        <LegalOps dashboard={dashboard} />
        <StaffSecurity dashboard={dashboard} />
      </div>

      <div className="mt-3">
        <SystemHealth dashboard={dashboard} />
      </div>
    </div>
  );
}
