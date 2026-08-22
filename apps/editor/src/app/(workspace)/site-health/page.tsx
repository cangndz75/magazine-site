import { CAPABILITY, type SiteHealthDto } from "@magazine/domain";
import { getSiteHealth } from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import { editorScopeFromSession } from "@/lib/content/authorize";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sistem Sağlığı",
};

const SECTION_KEYS = [
  "database",
  "outbox",
  "scheduledPublishing",
  "analytics",
  "seo",
  "homepage",
  "media",
  "cache",
] as const;

function formatMetricValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "Bilinmiyor";
  }
  if (typeof value === "boolean") {
    return value ? "Evet" : "Hayır";
  }
  return String(value);
}

export default async function SiteHealthPage() {
  const session = await requireCapability(CAPABILITY.STAFF_MANAGE);
  const health = await getSiteHealth({
    scope: editorScopeFromSession(session),
  });

  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Operasyon
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-950">Sistem Sağlığı</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">
              {health.overall.summary}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Genel durum
            </p>
            <p className="text-lg font-semibold text-zinc-950">
              {health.overall.label}
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {SECTION_KEYS.map((key) => {
          const section = health[key] as SiteHealthDto[(typeof SECTION_KEYS)[number]];
          return (
            <article key={key} className="rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-950">
                    {section.label}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-600">{section.summary}</p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                  {section.status}
                </span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm">
                {Object.entries(section.metrics).map(([metric, value]) => (
                  <div key={metric} className="flex justify-between gap-4 border-t border-zinc-100 pt-2">
                    <dt className="text-zinc-500">{metric}</dt>
                    <dd className="font-medium text-zinc-900">{formatMetricValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </article>
          );
        })}
      </section>
    </main>
  );
}
