import Link from "next/link";
import { CAPABILITY } from "@magazine/domain";
import {
  getSuperAdminDashboard,
  type DashboardSection,
  type SuperAdminDashboardDto,
} from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import { editorScopeFromSession } from "@/lib/content/authorize";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kontrol Merkezi",
};

function Section({
  title,
  section,
  children,
}: {
  title: string;
  section: DashboardSection<unknown>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-950">{title}</h2>
        <span className="text-xs font-medium text-zinc-500">{section.status}</span>
      </div>
      {section.status === "AVAILABLE" ? (
        children
      ) : (
        <p className="text-sm text-zinc-500">Kaynak şu anda okunamadı.</p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-zinc-950">{value ?? "Uygun değil"}</dd>
    </div>
  );
}

function ItemLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="font-medium text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-700" href={href}>
      {children}
    </Link>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Uygun değil";
  }
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}

function DashboardContent({ dashboard }: { dashboard: SuperAdminDashboardDto }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950">Kontrol Merkezi</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Üretilme zamanı: {formatDate(dashboard.generatedAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Editoryal Özet" section={dashboard.editorial}>
          {dashboard.editorial.status === "AVAILABLE" && (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="Taslak" value={dashboard.editorial.data.draft} />
              <Metric label="İncelemede" value={dashboard.editorial.data.inReview} />
              <Metric label="Onaylı" value={dashboard.editorial.data.approved} />
              <Metric label="Değişiklik İstendi" value={dashboard.editorial.data.changesRequested} />
              <Metric label="Planlı" value={dashboard.editorial.data.scheduled} />
              <Metric label="Yayında" value={dashboard.editorial.data.published} />
            </dl>
          )}
        </Section>

        <Section title="Personel / Güvenlik" section={dashboard.staffSecurity}>
          {dashboard.staffSecurity.status === "AVAILABLE" && (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Metric label="Toplam" value={dashboard.staffSecurity.data.total} />
              <Metric label="Aktif" value={dashboard.staffSecurity.data.active} />
              <Metric label="Devre Dışı" value={dashboard.staffSecurity.data.disabled} />
              <Metric label="Super Admin" value={dashboard.staffSecurity.data.superAdmin} />
              <Metric label="MFA Var" value={dashboard.staffSecurity.data.mfaConfigured} />
              <Metric label="MFA Yok" value={dashboard.staffSecurity.data.mfaNotConfigured} />
            </dl>
          )}
        </Section>

        <Section title="Dikkat Gerektirenler" section={dashboard.attention}>
          {dashboard.attention.status === "AVAILABLE" && (
            <ul className="space-y-3">
              {dashboard.attention.data.items.map((item) => (
                <li key={`${item.contentItemId}:${item.signal}`} className="text-sm">
                  <ItemLink href={item.targetHref}>{item.title}</ItemLink>
                  <span className="ml-2 text-xs text-zinc-500">
                    {item.signal} · {formatDate(item.eventAt)}
                  </span>
                </li>
              ))}
              {dashboard.attention.data.items.length === 0 && (
                <li className="text-sm text-zinc-500">Kayıt yok.</li>
              )}
            </ul>
          )}
        </Section>

        <Section title="Planlı Yayınlar" section={dashboard.upcomingPublishing}>
          {dashboard.upcomingPublishing.status === "AVAILABLE" && (
            <ul className="space-y-3">
              {dashboard.upcomingPublishing.data.items.map((item) => (
                <li key={item.contentItemId} className="text-sm">
                  <ItemLink href={item.targetHref}>{item.title}</ItemLink>
                  <span className="ml-2 text-xs text-zinc-500">
                    {formatDate(item.scheduledAt)}
                  </span>
                </li>
              ))}
              {dashboard.upcomingPublishing.data.items.length === 0 && (
                <li className="text-sm text-zinc-500">Kayıt yok.</li>
              )}
            </ul>
          )}
        </Section>

        <Section title="İnceleme Kuyruğu" section={dashboard.review}>
          {dashboard.review.status === "AVAILABLE" && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-4">
                <Metric label="Toplam" value={dashboard.review.data.count} />
                <Metric label="Değişiklik İstendi" value={dashboard.review.data.changesRequested} />
              </dl>
              <ul className="space-y-3">
                {dashboard.review.data.items.map((item) => (
                  <li key={item.versionId} className="text-sm">
                    <ItemLink href={item.targetHref}>{item.title}</ItemLink>
                    <span className="ml-2 text-xs text-zinc-500">
                      Tur {item.reviewRound} · {formatDate(item.latestSubmittedAt)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link className="text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4" href={dashboard.review.data.targetHref}>
                İnceleme kuyruğuna git
              </Link>
            </div>
          )}
        </Section>

        <Section title="Analytics" section={dashboard.analytics}>
          {dashboard.analytics.status === "AVAILABLE" && (
            <dl className="grid grid-cols-2 gap-4">
              <Metric label="Article Views" value={dashboard.analytics.data.metrics.articleViews} />
              <Metric label="Homepage Impressions" value={dashboard.analytics.data.metrics.homepageImpressions} />
              <Metric label="Homepage Clicks" value={dashboard.analytics.data.metrics.homepageClicks} />
              <Metric label="Homepage CTR" value={dashboard.analytics.data.metrics.homepageCtr} />
            </dl>
          )}
        </Section>

        <Section title="Yasal" section={dashboard.legal}>
          {dashboard.legal.status === "AVAILABLE" && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-4">
                <Metric label="Aktif Hold" value={dashboard.legal.data.activeHolds} />
                <Metric label="Takedown" value={dashboard.legal.data.activeTakedowns} />
                <Metric label="Retraction" value={dashboard.legal.data.activeRetractions} />
                <Metric label="Correction" value={dashboard.legal.data.corrections} />
              </dl>
              <ul className="space-y-3">
                {dashboard.legal.data.recentActions.map((item) => (
                  <li key={item.actionId} className="text-sm">
                    <ItemLink href={item.targetHref}>{item.articleTitle}</ItemLink>
                    <span className="ml-2 text-xs text-zinc-500">
                      {item.actionType} · {formatDate(item.effectiveAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section title="Ana Sayfa" section={dashboard.homepage}>
          {dashboard.homepage.status === "AVAILABLE" && (
            <dl className="grid grid-cols-2 gap-4">
              <Metric label="Live Version" value={dashboard.homepage.data.liveVersionId} />
              <Metric label="Son Yayın" value={formatDate(dashboard.homepage.data.lastPublishedAt)} />
              <Metric label="Yayınlanmamış Taslak" value={dashboard.homepage.data.unpublishedDraftExists ? "Var" : "Yok"} />
              <Metric label="Live Slot" value={dashboard.homepage.data.publishedSlotCount} />
              <Metric label="Draft Slot" value={dashboard.homepage.data.draftSlotCount} />
            </dl>
          )}
        </Section>

        <Section title="SEO / Sistem" section={dashboard.seo.status === "AVAILABLE" ? dashboard.seo : dashboard.systemSignals}>
          <div className="grid gap-4 sm:grid-cols-2">
            {dashboard.seo.status === "AVAILABLE" ? (
              <dl className="grid grid-cols-2 gap-4">
                <Metric label="Erişilebilir" value={dashboard.seo.data.accessibleCount} />
                <Metric label="Hata" value={dashboard.seo.data.errorCount} />
                <Metric label="Uyarı" value={dashboard.seo.data.warningCount} />
                <Metric label="Index Dışı" value={dashboard.seo.data.notIndexableCount} />
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">SEO özeti okunamadı.</p>
            )}
            {dashboard.systemSignals.status === "AVAILABLE" ? (
              <dl className="grid grid-cols-2 gap-4">
                <Metric label="Outbox Pending" value={dashboard.systemSignals.data.publicCacheOutbox.pending} />
                <Metric label="Outbox Processing" value={dashboard.systemSignals.data.publicCacheOutbox.processing} />
                <Metric label="Outbox Failed" value={dashboard.systemSignals.data.publicCacheOutbox.failed} />
                <Metric label="Outbox Completed" value={dashboard.systemSignals.data.publicCacheOutbox.completed} />
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">Sistem sinyalleri okunamadı.</p>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const session = await requireCapability(CAPABILITY.STAFF_MANAGE);
  const dashboard = await getSuperAdminDashboard({
    scope: editorScopeFromSession(session),
  });

  return <DashboardContent dashboard={dashboard} />;
}
