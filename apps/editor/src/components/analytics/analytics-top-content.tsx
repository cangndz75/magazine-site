"use client";

import Link from "next/link";
import { ANALYTICS_CONTENT_SORT } from "@magazine/domain";
import { analyticsPageHref, type AnalyticsPageFilters } from "@/lib/analytics/page-params";
import {
  ANALYTICS_CONTENT_SORT_LABEL,
  ANALYTICS_CTR_MIN_IMPRESSIONS_NOTE,
  formatAnalyticsCount,
  formatAnalyticsCtr,
} from "@/lib/analytics/presentation";
import type { AnalyticsContentItemDto } from "@/lib/analytics/types";

type Props = {
  filters: AnalyticsPageFilters;
  content: AnalyticsContentItemDto[];
  selectedContentItemId: string | null;
  onSelect: (contentItemId: string) => void;
};

const SORT_OPTIONS = [
  ANALYTICS_CONTENT_SORT.ARTICLE_VIEWS,
  ANALYTICS_CONTENT_SORT.HOMEPAGE_CLICKS,
  ANALYTICS_CONTENT_SORT.HOMEPAGE_CTR,
] as const;

export function AnalyticsTopContent({ filters, content, selectedContentItemId, onSelect }: Props) {
  return (
    <section className="mb-6 rounded border border-zinc-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">En Çok Etkileşim Alan İçerikler</h2>
        <div className="flex gap-1" role="group" aria-label="Sıralama">
          {SORT_OPTIONS.map((sort) => (
            <Link
              key={sort}
              href={analyticsPageHref({ ...filters, sort })}
              aria-current={filters.sort === sort ? "true" : undefined}
              className={`rounded px-2.5 py-1 text-xs font-medium ${
                filters.sort === sort
                  ? "bg-pink-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {ANALYTICS_CONTENT_SORT_LABEL[sort]}
            </Link>
          ))}
        </div>
      </div>

      {content.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-zinc-500">
          Bu dönemde görüntüleme yok.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-xs text-zinc-500">
                <th className="px-4 py-2 font-medium">İçerik</th>
                <th className="px-3 py-2 font-medium">Kategori</th>
                <th className="px-3 py-2 font-medium text-right">Görüntüleme</th>
                <th className="px-3 py-2 font-medium text-right">Anasayfa Gösterim</th>
                <th className="px-3 py-2 font-medium text-right">Tıklama</th>
                <th className="px-3 py-2 font-medium text-right">CTR</th>
                <th className="px-3 py-2 font-medium text-right">Galeri</th>
                <th className="px-4 py-2 font-medium text-right">Video</th>
              </tr>
            </thead>
            <tbody>
              {content.map((item) => (
                <tr
                  key={item.contentItemId}
                  onClick={() => onSelect(item.contentItemId)}
                  aria-pressed={selectedContentItemId === item.contentItemId}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(item.contentItemId);
                    }
                  }}
                  className={`cursor-pointer border-b border-zinc-50 hover:bg-zinc-50 focus:outline-none focus-visible:bg-pink-50 ${
                    selectedContentItemId === item.contentItemId ? "bg-pink-50" : ""
                  }`}
                >
                  <td className="max-w-[18rem] truncate px-4 py-2.5 font-medium text-zinc-900">
                    {item.display?.title ?? item.contentItemId}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-600">
                    {item.display?.primaryCategoryName ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAnalyticsCount(item.articleViews)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAnalyticsCount(item.homepageImpressions)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAnalyticsCount(item.homepageClicks)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAnalyticsCtr(item.homepageCtr)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {formatAnalyticsCount(item.galleryImageViews)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatAnalyticsCount(item.videoImpressions)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filters.sort === ANALYTICS_CONTENT_SORT.HOMEPAGE_CTR && (
        <p className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-500">
          {ANALYTICS_CTR_MIN_IMPRESSIONS_NOTE}
        </p>
      )}
    </section>
  );
}
