import Link from "next/link";
import type { ReactNode } from "react";
import type { SiteHealthDto, SiteHealthStatus } from "@magazine/domain";
import {
  actionLinkLabel,
  buildSummaryStrip,
  formatSiteHealthCount,
  formatSiteHealthDateTime,
  formatSiteHealthTimestamp,
  siteHealthStatusLabel,
  siteHealthTone,
  SITE_HEALTH_TONE_STYLES,
} from "@/lib/site-health/presentation";

const COMPACT_CARD =
  "rounded-lg border border-zinc-200 bg-white shadow-[0_1px_0_rgba(24,24,27,0.03)]";
const CARD_HEADER =
  "flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2.5";
const CARD_TITLE = "text-[11px] font-semibold uppercase tracking-wide text-zinc-500";

type Props = {
  health: SiteHealthDto;
};

function StatusIcon({ status, className = "" }: { status: SiteHealthStatus; className?: string }) {
  const tone = siteHealthTone(status);
  const styles = SITE_HEALTH_TONE_STYLES[tone];

  if (status === "HEALTHY") {
    return (
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className={`size-4 shrink-0 ${styles.icon} ${className}`}
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  if (status === "UNAVAILABLE") {
    return (
      <svg
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
        className={`size-4 shrink-0 ${styles.icon} ${className}`}
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 7zm0 8a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={`size-4 shrink-0 ${styles.icon} ${className}`}
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.62-1.516 2.62H3.72c-1.347 0-2.21-1.553-1.516-2.62L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function StatusBadge({ status }: { status: SiteHealthStatus }) {
  const tone = siteHealthTone(status);
  const styles = SITE_HEALTH_TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${styles.badge}`}
    >
      <StatusIcon status={status} className="size-3.5" />
      {siteHealthStatusLabel(status)}
    </span>
  );
}

function ModuleSection({
  title,
  status,
  actionHref,
  children,
  className = "",
  attention = false,
}: {
  title: string;
  status: SiteHealthStatus;
  actionHref?: string | null;
  children: ReactNode;
  className?: string;
  attention?: boolean;
}) {
  const actionLabel = actionLinkLabel(actionHref ?? null);
  return (
    <section
      className={`${COMPACT_CARD} ${attention ? "border-amber-300 ring-1 ring-amber-200/80" : ""} ${className}`}
    >
      <div className={CARD_HEADER}>
        <div className="flex min-w-0 items-center gap-2">
          <h2 className={CARD_TITLE}>{title}</h2>
          <StatusBadge status={status} />
        </div>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="shrink-0 text-[11px] font-semibold text-[var(--brand-magenta)] hover:text-[var(--brand-magenta-hover)]"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="px-3 py-3">{children}</div>
    </section>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-zinc-100 py-2 first:border-t-0 first:pt-0">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-900 text-right">{value}</span>
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm leading-relaxed text-zinc-500" role="status">
      {children}
    </p>
  );
}

function OverallHeader({ health }: { health: SiteHealthDto }) {
  const overallTone = siteHealthTone(health.overall.status);
  const overallStyles = SITE_HEALTH_TONE_STYLES[overallTone];

  return (
    <header className="space-y-3 border-b border-zinc-200 pb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Operasyon
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
            Sistem Sağlığı
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Yayın altyapısı, iş kuyrukları ve kritik operasyon sinyallerini takip edin.
          </p>
        </div>
        <div className="text-xs text-zinc-500 lg:text-right">
          <span>Güncellendi: {formatSiteHealthDateTime(health.generatedAt)}</span>
        </div>
      </div>

      <div
        className={`rounded-lg border px-4 py-3 ${overallStyles.strip}`}
        role="status"
        aria-label="Genel durum"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
          Genel Durum
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <StatusBadge status={health.overall.status} />
          <p className="text-sm leading-relaxed text-zinc-700">{health.overall.summary}</p>
        </div>
      </div>
    </header>
  );
}

function SummaryStrip({ health }: { health: SiteHealthDto }) {
  const items = buildSummaryStrip(health);

  return (
    <div
      role="list"
      aria-label="Sistem özeti"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-9"
    >
      {items.map((item) => {
        const tone = siteHealthTone(item.status);
        const styles = SITE_HEALTH_TONE_STYLES[tone];
        return (
          <div
            key={item.key}
            role="listitem"
            className={`min-w-0 rounded-lg border px-2.5 py-2 ${styles.strip}`}
          >
            <div className="flex items-center gap-1.5">
              <StatusIcon status={item.status} className="size-3.5" />
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                {item.label}
              </p>
            </div>
            <p className="mt-1 truncate text-xs font-medium text-zinc-900">{item.context}</p>
          </div>
        );
      })}
    </div>
  );
}

function OutboxModule({ health }: { health: SiteHealthDto }) {
  const section = health.outbox;
  const dead = section.metrics.dead;
  const hasDead = dead !== null && dead > 0;
  const unavailable = section.availability === "UNAVAILABLE";

  return (
    <ModuleSection
      title="İş Kuyruğu"
      status={section.status}
      attention={hasDead}
      className="lg:col-span-7"
    >
      <p className="mb-3 text-sm leading-relaxed text-zinc-600">{section.summary}</p>
      {unavailable ? (
        <EmptyNote>Kuyruk sinyali okunamadı.</EmptyNote>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Bekleyen
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">
              {formatSiteHealthCount(section.metrics.pending)}
            </p>
          </div>
          <div className="rounded-md border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              İşleniyor
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-950">
              {formatSiteHealthCount(section.metrics.processing)}
            </p>
          </div>
          <div
            className={`rounded-md border px-3 py-2.5 ${
              hasDead
                ? "border-amber-300 bg-amber-50"
                : "border-zinc-100 bg-zinc-50/80"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Başarısız ve müdahale bekleyen
            </p>
            <p
              className={`mt-1 text-2xl font-semibold tabular-nums ${
                hasDead ? "text-amber-950" : "text-zinc-950"
              }`}
            >
              {formatSiteHealthCount(dead)}
            </p>
            {dead === 0 ? (
              <p className="mt-1 text-xs text-zinc-500">Dead job bulunmuyor.</p>
            ) : null}
          </div>
        </div>
      )}
    </ModuleSection>
  );
}

function ScheduledModule({ health }: { health: SiteHealthDto }) {
  const section = health.scheduledPublishing;
  const unavailable = section.availability === "UNAVAILABLE";
  const count = section.metrics.scheduledCount;

  return (
    <ModuleSection
      title="Zamanlanmış Yayınlar"
      status={section.status}
      actionHref={section.actionTarget}
      className="lg:col-span-5"
    >
      <p className="mb-3 text-sm leading-relaxed text-zinc-600">{section.summary}</p>
      {unavailable ? (
        <EmptyNote>Zamanlanmış yayın sinyali okunamadı.</EmptyNote>
      ) : count === 0 ? (
        <EmptyNote>Planlanmış yayın bulunmuyor.</EmptyNote>
      ) : (
        <>
          <MetricRow
            label="Toplam zamanlanmış"
            value={formatSiteHealthCount(section.metrics.scheduledCount)}
          />
          <MetricRow
            label="Gecikmiş"
            value={formatSiteHealthCount(section.metrics.overdueCount)}
          />
          <MetricRow
            label="Sıradaki yayın"
            value={formatSiteHealthDateTime(section.metrics.nextScheduledAt)}
          />
        </>
      )}
    </ModuleSection>
  );
}

function AnalyticsModule({ health }: { health: SiteHealthDto }) {
  const section = health.analytics;
  const unavailable = section.metrics.availability === "UNAVAILABLE";

  return (
    <ModuleSection
      title="Analytics"
      status={section.status}
      actionHref={section.actionTarget}
      className="lg:col-span-4"
    >
      {unavailable ? (
        <EmptyNote>Analytics verisi şu anda kullanılamıyor.</EmptyNote>
      ) : (
        <>
          <p className="mb-3 text-sm leading-relaxed text-zinc-600">{section.summary}</p>
          <MetricRow label="Durum" value="Kullanılabilir" />
          <MetricRow
            label="Son aggregate"
            value={formatSiteHealthDateTime(section.metrics.lastCompletedAt)}
          />
          <MetricRow
            label="Son başarılı veri"
            value={formatSiteHealthTimestamp(section.metrics.lastSuccessfulThrough)}
          />
        </>
      )}
    </ModuleSection>
  );
}

function SeoModule({ health }: { health: SiteHealthDto }) {
  const section = health.seo;
  const unavailable = section.availability === "UNAVAILABLE";

  return (
    <ModuleSection
      title="SEO Sağlığı"
      status={section.status}
      actionHref={section.actionTarget}
      className="lg:col-span-4"
    >
      {unavailable ? (
        <EmptyNote>SEO denetim özeti okunamadı.</EmptyNote>
      ) : (
        <>
          <p className="mb-3 text-sm leading-relaxed text-zinc-600">{section.summary}</p>
          <MetricRow
            label="Sağlıklı yayın"
            value={formatSiteHealthCount(section.metrics.healthy)}
          />
          <MetricRow
            label="Dikkat gerektiren"
            value={formatSiteHealthCount(section.metrics.attention)}
          />
          <MetricRow label="Kritik" value={formatSiteHealthCount(section.metrics.critical)} />
        </>
      )}
    </ModuleSection>
  );
}

function MediaModule({ health }: { health: SiteHealthDto }) {
  const section = health.media;
  const unavailable = section.availability === "UNAVAILABLE";

  return (
    <ModuleSection
      title="Medya Sağlığı"
      status={section.status}
      actionHref={section.actionTarget}
      className="lg:col-span-4"
    >
      {unavailable ? (
        <EmptyNote>Medya hak özeti okunamadı.</EmptyNote>
      ) : (
        <>
          <p className="mb-3 text-sm leading-relaxed text-zinc-600">{section.summary}</p>
          <MetricRow
            label="Hak engelli medya"
            value={formatSiteHealthCount(section.metrics.rightsIneligible)}
          />
          <MetricRow
            label="Süresi dolmuş lisans"
            value={formatSiteHealthCount(section.metrics.expiredLicenses)}
          />
          <MetricRow
            label="Credit eksik"
            value={formatSiteHealthCount(section.metrics.missingCredit)}
          />
        </>
      )}
    </ModuleSection>
  );
}

function HomepageModule({ health }: { health: SiteHealthDto }) {
  const section = health.homepage;
  const unavailable = section.availability === "UNAVAILABLE";

  return (
    <ModuleSection
      title="Ana Sayfa"
      status={section.status}
      actionHref={section.actionTarget}
      className="lg:col-span-6"
    >
      {unavailable ? (
        <EmptyNote>Ana sayfa durumu okunamadı.</EmptyNote>
      ) : (
        <>
          <p className="mb-3 text-sm leading-relaxed text-zinc-600">{section.summary}</p>
          <MetricRow
            label="Yayınlanmış sürüm"
            value={section.metrics.liveVersionAvailable ? "Var" : "Yok"}
          />
          <MetricRow
            label="Son yayın"
            value={formatSiteHealthDateTime(section.metrics.lastPublishedAt)}
          />
          <MetricRow
            label="Canlı slot"
            value={formatSiteHealthCount(section.metrics.publishedSlotCount)}
          />
          <MetricRow
            label="Şu An Konuşuluyor (aktif)"
            value={formatSiteHealthCount(section.metrics.activeConversationItemCount)}
          />
        </>
      )}
    </ModuleSection>
  );
}

function CacheModule({ health }: { health: SiteHealthDto }) {
  const section = health.cache;
  const unavailable = section.availability === "UNAVAILABLE";
  const runtimeObservable = section.metrics.runtimeObservable;

  return (
    <ModuleSection title="Cache / Invalidation" status={section.status} className="lg:col-span-6">
      {unavailable ? (
        <EmptyNote>Cache invalidation sinyali okunamadı.</EmptyNote>
      ) : (
        <>
          <p className="mb-3 text-sm leading-relaxed text-zinc-600">
            {runtimeObservable
              ? section.summary
              : "Cache runtime doğrudan gözlemlenemiyor."}
          </p>
          {!runtimeObservable ? (
            <p className="mb-3 text-xs text-zinc-500">
              Cache runtime ölçümü mevcut değil; yalnızca invalidation outbox sayımları
              gösteriliyor.
            </p>
          ) : null}
          {section.metrics.invalidationOutboxObservable ? (
            <>
              <MetricRow
                label="Invalidation bekleyen"
                value={formatSiteHealthCount(section.metrics.pending)}
              />
              <MetricRow
                label="Invalidation işleniyor"
                value={formatSiteHealthCount(section.metrics.processing)}
              />
              <MetricRow
                label="Başarısız invalidation"
                value={formatSiteHealthCount(section.metrics.dead)}
              />
            </>
          ) : (
            <EmptyNote>Invalidation outbox gözlemlenemiyor.</EmptyNote>
          )}
        </>
      )}
    </ModuleSection>
  );
}

function FeatureControlsModule({ health }: { health: SiteHealthDto }) {
  const section = health.featureControls;
  const unavailable = section.availability === "UNAVAILABLE";
  const killActive = section.metrics.killSwitchesActive ?? 0;
  const flagsDisabled = section.metrics.featureFlagsDisabled ?? 0;
  const needsAttention = killActive > 0 || flagsDisabled > 0;

  return (
    <ModuleSection
      title="Özellik Kontrolleri"
      status={section.status}
      actionHref={section.actionTarget}
      attention={needsAttention}
      className="lg:col-span-6"
    >
      {unavailable ? (
        <EmptyNote>Özellik kontrol sinyali okunamadı.</EmptyNote>
      ) : (
        <>
          <p className="mb-3 text-sm leading-relaxed text-zinc-600">{section.summary}</p>
          <MetricRow
            label="Aktif acil durum kontrolü"
            value={formatSiteHealthCount(section.metrics.killSwitchesActive)}
          />
          <MetricRow
            label="Kapalı özellik bayrağı"
            value={formatSiteHealthCount(section.metrics.featureFlagsDisabled)}
          />
        </>
      )}
    </ModuleSection>
  );
}

function DatabaseModule({ health }: { health: SiteHealthDto }) {
  const section = health.database;
  const unavailable = section.availability === "UNAVAILABLE";

  return (
    <ModuleSection title="Veritabanı" status={section.status} className="lg:col-span-4">
      {unavailable ? (
        <EmptyNote>Veritabanı sinyali okunamadı.</EmptyNote>
      ) : (
        <>
          <MetricRow
            label="Bağlantı"
            value={section.metrics.available ? "Bağlantı kullanılabilir" : "Kullanılamıyor"}
          />
          <MetricRow
            label="Kontrol zamanı"
            value={formatSiteHealthDateTime(section.metrics.queryTimestamp)}
          />
        </>
      )}
    </ModuleSection>
  );
}

export function SiteHealthWorkspace({ health }: Props) {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4">
      <OverallHeader health={health} />
      <SummaryStrip health={health} />
      <div className="grid gap-3 lg:grid-cols-12">
        <OutboxModule health={health} />
        <ScheduledModule health={health} />
        <AnalyticsModule health={health} />
        <SeoModule health={health} />
        <MediaModule health={health} />
        <HomepageModule health={health} />
        <CacheModule health={health} />
        <FeatureControlsModule health={health} />
        <DatabaseModule health={health} />
      </div>
    </div>
  );
}
