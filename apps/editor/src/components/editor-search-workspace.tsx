import Link from "next/link";
import type { EditorSearchResultsDto } from "@magazine/domain";

type Props = {
  query: string;
  results: EditorSearchResultsDto;
};

export function EditorSearchWorkspace({ query, results }: Props) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-950">Haber Masası Arama</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Başlık, slug veya profil adıyla içerik bulun. Erişim kapsamınız dışındaki içerikler
          listelenmez.
        </p>
      </header>

      <form action="/search" method="get" className="flex gap-2" role="search">
        <label className="sr-only" htmlFor="editor-search-q">Arama</label>
        <input
          id="editor-search-q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Başlık veya profil ara…"
          minLength={2}
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
          required
        />
        <button
          type="submit"
          className="rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Ara
        </button>
      </form>

      {query.trim().length < 2 ? (
        <p className="text-sm text-zinc-500">En az 2 karakter girin.</p>
      ) : results.items.length === 0 ? (
        <p className="text-sm text-zinc-600" role="status">
          Aramanızla eşleşen içerik bulunamadı.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
          {results.items.map((item) => (
            <li key={item.contentItemId}>
              <Link
                href={item.editorHref}
                className="block px-4 py-3 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-700"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {item.contentKind} · {item.publicationStatus}
                </p>
                <p className="mt-1 font-medium text-zinc-950">{item.title}</p>
                <p className="text-xs text-zinc-500">{item.slug}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
