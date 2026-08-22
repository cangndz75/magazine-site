import { AnalyticsHomepageView } from "@/components/analytics/analytics-page-view";
import { HomepageAnalyticsProvider } from "@/components/analytics/homepage-analytics-context";
import { HomepageFeatured } from "@/components/homepage-featured";
import { HomepageLatest } from "@/components/homepage-latest";
import { HomepageLeadGrid } from "@/components/homepage-lead-grid";
import { PublicUtilityBar } from "@/components/public-utility-bar";
import { getPublicHomepage } from "@/lib/public-homepage";
/**
 * Homepage reads are still uncached: there is no homepage invalidation graph.
 * Next.js 16.3.1 here does not enable Cache Components, so this page would
 * otherwise statically prerender a PostgreSQL snapshot at build time.
 * Route-level force-dynamic is the isolated, first-class opt-out for `/`.
 *
 * The utility bar's "today" date is rendered only here (not in the shared
 * layout) for the same reason: other public routes are not force-dynamic,
 * and a date rendered in a statically-prerendered layout would freeze at
 * build time.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const homepage = await getPublicHomepage();

  if (!homepage.lead) {
    return (
      <div className="homepage">
        {homepage.homepageViewContext ? (
          <AnalyticsHomepageView
            homepageVersionId={homepage.homepageVersionId}
            analyticsContext={homepage.homepageViewContext}
          />
        ) : null}
        <PublicUtilityBar />
        <div className="homepage__inner">
          <div className="homepage__empty">
            <p className="homepage__empty-kicker">Magazin</p>
            <h1 className="homepage__empty-title">Henüz yayınlanmış içerik bulunmuyor.</h1>
          </div>
        </div>
      </div>
    );
  }

  const hasFeatured = homepage.featured.length > 0;

  return (
    <div className="homepage">
      {homepage.homepageViewContext ? (
        <AnalyticsHomepageView
          homepageVersionId={homepage.homepageVersionId}
          analyticsContext={homepage.homepageViewContext}
        />
      ) : null}
      <PublicUtilityBar />
      <HomepageAnalyticsProvider homepageVersionId={homepage.homepageVersionId}>
        <div className="homepage__inner">
          <div className="homepage__canvas">
            <HomepageLeadGrid homepage={homepage} />

            {hasFeatured ? (
              <div className="homepage__featured-row">
                <HomepageFeatured
                  stories={homepage.featured}
                  placements={homepage.analyticsPlacements}
                />
              </div>
            ) : null}

            <HomepageLatest stories={homepage.latest} />
          </div>
        </div>
      </HomepageAnalyticsProvider>
    </div>
  );
}
