import { formatAnalyticsCount } from "@/lib/analytics/presentation";
import type { AnalyticsCategoriesDto } from "@/lib/analytics/types";

export function AnalyticsCategoryPerformance({ categories }: { categories: AnalyticsCategoriesDto }) {
  return (
    <section className="mb-6 rounded border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900">Kategori Performansı</h2>
      {categories.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">Bu dönemde görüntüleme yok.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs text-zinc-500">
              <th className="py-2 font-medium">Kategori</th>
              <th className="py-2 text-right font-medium">Görüntüleme</th>
              <th className="py-2 text-right font-medium">İçerik Sayısı</th>
            </tr>
          </thead>
          <tbody>
            {categories.items.map((item) => (
              <tr key={item.categoryId} className="border-b border-zinc-50 last:border-0">
                <td className="py-2 text-zinc-800">{item.name ?? "Bilinmeyen kategori"}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatAnalyticsCount(item.articleViews)}
                </td>
                <td className="py-2 text-right tabular-nums text-zinc-500">
                  {formatAnalyticsCount(item.contentCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
