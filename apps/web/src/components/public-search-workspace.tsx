import Link from "next/link";
import type { SearchResultsDto } from "@magazine/domain";
import {
  formatSearchPublishedDate,
  searchResultTypeLabel,
} from "@/lib/search/presentation";
import {
  isPublicSearchQueryReady,
  publicSearchFilterTur,
  type PublicSearchPageParams,
} from "@/lib/search/page-params";

type Props = {
  params: PublicSearchPageParams;
  results: SearchResultsDto | null;
};

const FILTERS: { tur: string; label: string }[] = [
  { tur: "tumu", label: "Tümü" },
  { tur: "haber", label: "Haberler" },
  { tur: "galeri", label: "Foto Galeriler" },
  { tur: "profil", label: "Profiller" },
];

function buildSearchHref(
  q: string,
  tur: string,
  cursor?: string | null,
): string {
  const search = new URLSearchParams();
  if (q) {
    search.set("q", q);
  }
  if (tur && tur !== "tumu") {
    search.set("tur", tur);
  }
  if (cursor) {
    search.set("cursor", cursor);
  }
  const query = search.toString();
  return query ? `/arama?${query}` : "/arama";
}

export function PublicSearchWorkspace({ params, results }: Props) {
  const activeTur = publicSearchFilterTur(params.filter);
  const queryReady = isPublicSearchQueryReady(params.q);

  return (
    <div className="public-search">
      <header className="public-search__header">
        <h1 className="public-search__title">Arama</h1>
        <form className="public-search__form" action="/arama" method="get" role="search">
          <label className="public-search__label" htmlFor="public-search-q">
            Arama ifadesi
          </label>
          <div className="public-search__field-row">
            <input
              id="public-search-q"
              name="q"
              type="search"
              defaultValue={params.q}
              placeholder="Haber, galeri veya profil ara…"
              className="public-search__input"
              autoComplete="off"
              enterKeyHint="search"
              minLength={2}
              maxLength={120}
              required
            />
            {activeTur !== "tumu" ? (
              <input type="hidden" name="tur" value={activeTur} />
            ) : null}
            <button type="submit" className="public-search__submit">Ara</button>
          </div>
          {params.q ? (
            <Link href="/arama" className="public-search__clear">
              Aramayı temizle
            </Link>
          ) : null}
        </form>

        <nav className="public-search__filters" aria-label="Arama filtreleri">
          {FILTERS.map((filter) => (
            <Link
              key={filter.tur}
              href={buildSearchHref(params.q, filter.tur)}
              className={`public-search__filter${
                activeTur === filter.tur ? " public-search__filter--active" : ""
              }`}
              aria-current={activeTur === filter.tur ? "true" : undefined}
            >
              {filter.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="public-search__body" aria-live="polite">
        {!queryReady ? (
          <p className="public-search__hint">
            Aramaya başlamak için en az 2 karakter girin.
          </p>
        ) : results && results.items.length === 0 ? (
          <p className="public-search__empty" role="status">
            Aramanızla eşleşen içerik bulunamadı.
          </p>
        ) : results ? (
          <>
            <p className="public-search__summary" role="status">
              “{results.normalizedQuery}” için sonuçlar
            </p>
            <ul className="public-search__results">
              {results.items.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="public-search__result">
                  <Link href={item.href} className="public-search__result-link">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="public-search__result-thumb"
                        width={96}
                        height={64}
                      />
                    ) : (
                      <div className="public-search__result-thumb public-search__result-thumb--empty" />
                    )}
                    <div className="public-search__result-body">
                      <p className="public-search__result-type">
                        {searchResultTypeLabel(item.kind)}
                        {item.categoryLabel ? ` · ${item.categoryLabel}` : ""}
                      </p>
                      <p className="public-search__result-title">{item.title}</p>
                      {item.excerpt ? (
                        <p className="public-search__result-excerpt">{item.excerpt}</p>
                      ) : null}
                      {item.matchedEntityLabel ? (
                        <p className="public-search__result-context">
                          İlgili profil: {item.matchedEntityLabel}
                        </p>
                      ) : null}
                      {item.publishedAt ? (
                        <p className="public-search__result-date">
                          {formatSearchPublishedDate(item.publishedAt)}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {results.nextCursor ? (
              <div className="public-search__more">
                <Link
                  href={buildSearchHref(params.q, activeTur, results.nextCursor)}
                  className="public-search__more-link"
                >
                  Daha fazla sonuç
                </Link>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
