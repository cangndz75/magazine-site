import { SectionHeader } from "@/components/section-header";
import { HOMEPAGE_PREVIEW_HOROSCOPES } from "@/lib/homepage-preview-modules";

export function HomepageAstrology() {
  const featured = HOMEPAGE_PREVIEW_HOROSCOPES.find((item) => item.featured);
  const rest = HOMEPAGE_PREVIEW_HOROSCOPES.filter((item) => !item.featured);

  if (!featured) {
    return null;
  }

  return (
    <section
      className="homepage-astrology"
      aria-labelledby="homepage-astrology-heading"
    >
      <SectionHeader
        title="Astroloji"
        id="homepage-astrology-heading"
        variant="editorial"
      />
      <article className="homepage-astrology__featured">
        <p className="homepage-astrology__sign">{featured.sign}</p>
        <p className="homepage-astrology__dates">{featured.dates}</p>
        <p className="homepage-astrology__teaser">{featured.teaser}</p>
      </article>
      <ul className="homepage-astrology__list">
        {rest.map((item) => (
          <li key={item.key} className="homepage-astrology__row">
            <div className="homepage-astrology__row-head">
              <span className="homepage-astrology__row-sign">{item.sign}</span>
              <span className="homepage-astrology__row-dates">{item.dates}</span>
            </div>
            <p className="homepage-astrology__row-teaser">{item.teaser}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
