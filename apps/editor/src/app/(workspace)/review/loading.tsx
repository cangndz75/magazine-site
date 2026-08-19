export default function ReviewLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 h-7 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="mb-4 flex gap-3">
        <div className="h-8 w-64 animate-pulse rounded bg-zinc-100" />
        <div className="h-8 w-32 animate-pulse rounded bg-zinc-100" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}
