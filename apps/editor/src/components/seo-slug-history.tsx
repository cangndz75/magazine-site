import { formatDateTime } from "@/lib/content/format-date";
import type { SeoSlugHistoryDto } from "@/lib/seo/serialize";

export function SeoSlugHistory({ entries }: { entries: SeoSlugHistoryDto[] }) {
  return (
    <section className="mt-8" aria-labelledby="seo-slug-history-heading">
      <h2 id="seo-slug-history-heading" className="text-sm font-semibold text-zinc-900">
        URL Geçmişi
      </h2>
      <p className="mt-2 text-sm text-zinc-600">
        Eski URL ziyaretçileri mevcut URL’ye kalıcı olarak yönlendirilir. Geçmiş
        silinemez ve hedef elle değiştirilemez.
      </p>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Kayıtlı eski slug yok.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-100 rounded border border-zinc-200 bg-white">
          {entries.map((entry) => (
            <li key={`${entry.oldSlug}-${entry.createdAt}`} className="px-3 py-3 text-sm">
              <p className="break-all font-medium text-zinc-900">{entry.oldPath}</p>
              <p className="mt-1 break-all text-zinc-600">
                Hedef: {entry.destinationUrl ?? entry.destinationPath}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {formatDateTime(entry.createdAt)}
                {entry.actorDisplayName ? ` · ${entry.actorDisplayName}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
