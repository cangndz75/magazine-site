"use client";

import { useId, useState } from "react";
import { ANALYTICS_AUTHOR_CREDIT_NOTE, formatAnalyticsCount } from "@/lib/analytics/presentation";
import type { AnalyticsAuthorsDto } from "@/lib/analytics/types";

export function AnalyticsAuthorPerformance({ authors }: { authors: AnalyticsAuthorsDto }) {
  const [showHelp, setShowHelp] = useState(false);
  const helpId = useId();

  return (
    <section className="mb-6 rounded border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Yazar Performansı</h2>
        <button
          type="button"
          onClick={() => setShowHelp((value) => !value)}
          aria-expanded={showHelp}
          aria-controls={helpId}
          className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600 hover:bg-zinc-300"
        >
          ?
        </button>
      </div>
      {showHelp && (
        <p id={helpId} className="mb-3 rounded bg-zinc-50 px-2.5 py-2 text-xs text-zinc-600">
          {ANALYTICS_AUTHOR_CREDIT_NOTE}
        </p>
      )}
      {authors.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">Bu dönemde görüntüleme yok.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs text-zinc-500">
              <th className="py-2 font-medium">Yazar</th>
              <th className="py-2 text-right font-medium">Görüntüleme</th>
              <th className="py-2 text-right font-medium">İçerik Sayısı</th>
            </tr>
          </thead>
          <tbody>
            {authors.items.map((item) => (
              <tr key={item.authorId} className="border-b border-zinc-50 last:border-0">
                <td className="py-2 text-zinc-800">{item.displayName ?? "Bilinmeyen yazar"}</td>
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
