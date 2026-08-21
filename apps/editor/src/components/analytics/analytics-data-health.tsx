import { formatAnalyticsTime, presentAnalyticsFreshness } from "@/lib/analytics/presentation";
import type { AnalyticsFreshnessDto } from "@/lib/analytics/types";

export function AnalyticsDataHealth({ freshness }: { freshness: AnalyticsFreshnessDto }) {
  const presentation = presentAnalyticsFreshness(freshness);

  return (
    <div className="rounded border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900">Veri Güncelliği</h2>
      <dl className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-zinc-500">Durum</dt>
          <dd
            className={`font-medium ${
              presentation.tone === "ok"
                ? "text-emerald-600"
                : presentation.tone === "pending"
                  ? "text-amber-600"
                  : "text-red-600"
            }`}
          >
            {presentation.label}
          </dd>
        </div>
        {freshness.lastSuccessfulThrough && (
          <div className="flex items-center justify-between">
            <dt className="text-zinc-500">Son başarılı toplama</dt>
            <dd className="font-medium text-zinc-700">
              {formatAnalyticsTime(new Date(freshness.lastSuccessfulThrough))}
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-400">
        Analytics gerçek zamanlı değildir; sayılar periyodik toplama sonrası güncellenir.
      </p>
    </div>
  );
}
