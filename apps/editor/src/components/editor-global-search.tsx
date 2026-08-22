import Link from "next/link";

export function EditorGlobalSearch() {
  return (
    <form action="/search" method="get" className="px-4 pb-3" role="search">
      <label className="sr-only" htmlFor="editor-shell-search">Hızlı arama</label>
      <div className="flex gap-1">
        <input
          id="editor-shell-search"
          name="q"
          type="search"
          placeholder="İçerik ara…"
          minLength={2}
          className="min-w-0 flex-1 rounded border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-zinc-500"
        />
        <Link
          href="/search"
          className="rounded border border-white/15 px-2 py-1.5 text-[11px] font-semibold text-zinc-300 hover:bg-white/10"
        >
          Tümü
        </Link>
      </div>
    </form>
  );
}
