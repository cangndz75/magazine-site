"use client";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isForbidden =
    error.name === "AuthorizationError" || error.message === "Forbidden";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm font-medium text-zinc-700">
          {isForbidden
            ? "Bu sayfaya erişim yetkiniz yok."
            : "Sayfa yüklenirken bir hata oluştu."}
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {error.digest ? `Hata kodu: ${error.digest}` : "Lütfen tekrar deneyin."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Tekrar dene
        </button>
      </div>
    </div>
  );
}
