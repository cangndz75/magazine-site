export default function PublicSearchLoading() {
  return (
    <div className="public-search-page">
      <div className="public-search">
        <header className="public-search__header">
          <h1 className="public-search__title">Arama</h1>
        </header>
        <p className="public-search__hint" role="status" aria-busy="true">
          Sonuçlar yükleniyor…
        </p>
      </div>
    </div>
  );
}
