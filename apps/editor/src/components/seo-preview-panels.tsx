export function SeoPreviewPanels({
  title,
  visibleTitle,
  description,
  url,
  imageUrl,
}: {
  title: string;
  visibleTitle: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
}) {
  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-2">
      <section aria-labelledby="seo-serp-heading" className="min-w-0 rounded border border-zinc-200 bg-white p-4">
        <h2 id="seo-serp-heading" className="text-sm font-semibold text-zinc-900">
          Arama önizlemesi
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Önizleme — arama sonucu görünümü. Google simülasyonu değildir.
        </p>
        <div className="mt-3 min-w-0">
          <p className="truncate text-lg text-[#1a0dab]">{title || "Başlıksız"}</p>
          <p className="mt-0.5 break-all text-sm text-[#006621]">{url ?? "URL üretilemedi"}</p>
          <p className="mt-1 text-sm text-zinc-700">
            {description ?? "Açıklama yok. Gövdeden üretilmez."}
          </p>
        </div>
        {visibleTitle && visibleTitle !== title && (
          <p className="mt-3 text-xs text-zinc-500">
            Görünen H1 ayrıdır: {visibleTitle}
          </p>
        )}
      </section>

      <section aria-labelledby="seo-social-heading" className="min-w-0 rounded border border-zinc-200 bg-white p-4">
        <h2 id="seo-social-heading" className="text-sm font-semibold text-zinc-900">
          Sosyal önizleme
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Open Graph alanları — ayrı bir sosyal override modeli yoktur.
        </p>
        <div className="mt-3 overflow-hidden rounded border border-zinc-100">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              className="h-36 w-full object-cover"
            />
          ) : (
            <div className="flex h-24 items-center justify-center bg-zinc-100 text-xs text-zinc-500">
              HERO görseli yok
            </div>
          )}
          <div className="min-w-0 px-3 py-2">
            <p className="truncate text-sm font-medium text-zinc-900">{title || "Başlıksız"}</p>
            <p className="mt-1 line-clamp-2 text-xs text-zinc-600">
              {description ?? "Açıklama yok"}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
