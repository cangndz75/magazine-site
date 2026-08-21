import Link from "next/link";

export function ContentEmptyState({
  hasFilters,
  clearHref,
  emptyMessage,
  filteredMessage,
}: {
  hasFilters: boolean;
  clearHref: string;
  emptyMessage?: string;
  filteredMessage?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <p className="text-sm text-zinc-500">
        {hasFilters
          ? (filteredMessage ?? "Bu filtrelere uygun içerik bulunamadı.")
          : (emptyMessage ?? "Henüz içerik oluşturulmamış.")}
      </p>
      {hasFilters && (
        <Link
          href={clearHref}
          className="mt-3 text-sm text-zinc-600 underline hover:text-zinc-800"
        >
          Filtreleri temizle
        </Link>
      )}
    </div>
  );
}
