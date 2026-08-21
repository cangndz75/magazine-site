import { ANALYTICS_SOURCE_LABEL, formatAnalyticsCount } from "@/lib/analytics/presentation";
import type { AnalyticsSourcesDto } from "@/lib/analytics/types";

export function AnalyticsTrafficSources({ sources }: { sources: AnalyticsSourcesDto }) {
  return (
    <section className="mb-6 rounded border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900">Trafik Kaynakları</h2>
      {sources.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">Bu dönemde görüntüleme yok.</p>
      ) : (
        <ul className="space-y-2">
          {sources.items.map((item) => {
            const share = sources.total > 0 ? (item.eventCount / sources.total) * 100 : 0;
            return (
              <li key={item.sourceChannel}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-700">
                    {ANALYTICS_SOURCE_LABEL[item.sourceChannel as keyof typeof ANALYTICS_SOURCE_LABEL] ??
                      item.sourceChannel}
                  </span>
                  <span className="tabular-nums text-zinc-500">
                    {formatAnalyticsCount(item.eventCount)} · %{share.toFixed(0)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-pink-500"
                    style={{ width: `${Math.max(share, 2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
