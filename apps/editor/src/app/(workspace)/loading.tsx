export default function ContentLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <div className="h-7 w-28 animate-pulse rounded bg-zinc-200" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="h-8 w-64 animate-pulse rounded bg-zinc-100" />
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-100" />
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-100" />
      </div>

      <div className="overflow-hidden rounded border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-4 py-2.5">
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-zinc-100" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b border-zinc-50 px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-zinc-50" />
              </div>
              <div className="h-5 w-20 animate-pulse rounded bg-zinc-100" />
              <div className="hidden h-3 w-16 animate-pulse rounded bg-zinc-100 sm:block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
