export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-[100rem] px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="h-7 w-32 animate-pulse rounded bg-zinc-200" />
        <div className="h-8 w-56 animate-pulse rounded bg-zinc-100" />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded border border-zinc-200 bg-white" />
        ))}
      </div>

      <div className="mb-6 h-72 animate-pulse rounded border border-zinc-200 bg-white" />

      <div className="overflow-hidden rounded border border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-4 py-2.5">
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-zinc-100" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b border-zinc-50 px-4 py-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
