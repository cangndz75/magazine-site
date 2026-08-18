export default function ArticleLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-7">
      <div className="mb-5 h-4 w-32 animate-pulse rounded bg-zinc-200" />
      <div className="h-8 w-2/3 max-w-xl animate-pulse rounded bg-zinc-200" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded bg-zinc-100" />
          <div className="h-40 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded bg-zinc-100" />
          <div className="h-32 animate-pulse rounded bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}
