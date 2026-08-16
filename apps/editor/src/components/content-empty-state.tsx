import Link from "next/link";

export function ContentEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-zinc-200 bg-white py-16">
      <p className="text-sm text-zinc-500">
        {hasFilters
          ? "Bu filtrelere uygun içerik bulunamadı."
          : "Henüz içerik oluşturulmamış."}
      </p>
      {hasFilters && (
        <Link
          href="/"
          className="mt-3 text-sm text-zinc-600 underline hover:text-zinc-800"
        >
          Filtreleri temizle
        </Link>
      )}
    </div>
  );
}
