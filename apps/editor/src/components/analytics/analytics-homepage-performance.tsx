import type { AnalyticsPlacement } from "@magazine/domain";
import {
  ANALYTICS_PLACEMENT_LABEL,
  formatAnalyticsCount,
  formatAnalyticsCtr,
  isAnomalousCtr,
  isEditorialPlacement,
} from "@/lib/analytics/presentation";
import type { AnalyticsContentItemDto, AnalyticsHomepageDto } from "@/lib/analytics/types";

type Props = {
  homepage: AnalyticsHomepageDto;
  content: AnalyticsContentItemDto[];
};

export function AnalyticsHomepagePerformance({ homepage, content }: Props) {
  const titleById = new Map(
    content.map((item) => [item.contentItemId, item.display?.title ?? null]),
  );
  const sorted = [...homepage.items].sort((a, b) => b.impressions - a.impressions);

  function homepageTitle(item: AnalyticsHomepageDto["items"][number]): string {
    return item.display?.title ?? titleById.get(item.contentItemId) ?? item.contentItemId;
  }

  return (
    <section className="mb-6 rounded border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900">Anasayfa Performansı</h2>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">Bu dönemde görüntüleme yok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-500">
                <th className="py-2 font-medium">Yerleşim</th>
                <th className="py-2 font-medium">İçerik</th>
                <th className="py-2 text-right font-medium">Gösterim</th>
                <th className="py-2 text-right font-medium">Tıklama</th>
                <th className="py-2 text-right font-medium">CTR</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => {
                const editorial = isEditorialPlacement(item.placement as AnalyticsPlacement);
                const anomaly = isAnomalousCtr(item.ctr);
                return (
                  <tr
                    key={`${item.homepageVersionId ?? "fallback"}-${item.placement}-${item.position}-${item.contentItemId}`}
                    className="border-b border-zinc-50 last:border-0"
                  >
                    <td className="py-2">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          editorial
                            ? "bg-pink-50 text-pink-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {ANALYTICS_PLACEMENT_LABEL[item.placement as keyof typeof ANALYTICS_PLACEMENT_LABEL] ??
                          item.placement}
                      </span>
                    </td>
                    <td className="max-w-[16rem] truncate py-2 text-zinc-800">
                      {homepageTitle(item)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatAnalyticsCount(item.impressions)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatAnalyticsCount(item.clicks)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatAnalyticsCtr(item.ctr)}
                      {anomaly && (
                        <span
                          title="Tıklama sayısı gösterimden fazla — veri kalitesi kontrolü öneriliyor."
                          className="ml-1 text-amber-500"
                        >
                          ⚠
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-500">
        <span className="mr-1 inline-block rounded bg-pink-50 px-1.5 py-0.5 text-pink-700">
          Editoryal
        </span>
        Homepage Builder tarafından atanmış yerleşimleri,{" "}
        <span className="mx-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600">
          Otomatik Güncel Akış
        </span>
        ise editoryal seçim olmadan otomatik doldurulan alanları gösterir.
      </p>
    </section>
  );
}
