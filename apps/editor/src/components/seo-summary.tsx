import type { SeoInspectionSummary } from "@magazine/domain";
import { SEO_SUMMARY_MEASUREMENT } from "@magazine/domain";

export type SeoWorkspaceSummary = SeoInspectionSummary;

const CARDS: {
  key: Exclude<keyof SeoInspectionSummary, "measurements">;
  label: string;
  hint: string;
}[] = [
  {
    key: "errorCount",
    label: "Kritik SEO sorunu (SQL tahmini)",
    hint: "evaluateSeoHealth toplamı değil; SQL vekilidir",
  },
  {
    key: "warningCount",
    label: "Uyarı bulunan içerik (SQL tahmini)",
    hint: "evaluateSeoHealth toplamı değil; SQL vekilidir",
  },
  {
    key: "missingMetaDescriptionCount",
    label: "Eksik meta description",
    hint: "seoDescription, spot ve alt başlık boş — tam SQL eşleşmesi",
  },
  {
    key: "missingHeroCount",
    label: "Eksik HERO / alt",
    hint: "Kapak görseli veya alt metni yok — tam SQL eşleşmesi",
  },
  {
    key: "notIndexableCount",
    label: "Noindex içerik",
    hint: "Yayında değil, hukuki veya robots kısıtı — tam SQL eşleşmesi",
  },
  {
    key: "healthyPublishedCount",
    label: "Yayındaki sağlıklı içerik (SQL tahmini)",
    hint: "İndekslenebilir ve SQL vekilinde kritik/uyarı yok",
  },
];

function measurementHint(summary: SeoInspectionSummary, key: (typeof CARDS)[number]["key"]) {
  const kind = summary.measurements[key];
  if (kind === SEO_SUMMARY_MEASUREMENT.SQL_HEURISTIC) {
    return "Ölçüm: SQL tahmini";
  }
  return "Ölçüm: tam SQL";
}

export function SeoSummaryCards({ summary }: { summary: SeoWorkspaceSummary }) {
  return (
    <section aria-label="SEO özeti" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className="rounded border border-zinc-200 bg-white px-4 py-3"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            {card.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
            {summary[card.key]}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{card.hint}</p>
          <p className="mt-1 text-xs text-zinc-400">{measurementHint(summary, card.key)}</p>
        </div>
      ))}
    </section>
  );
}
