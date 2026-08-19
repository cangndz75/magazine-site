import { HomepageFeatured } from "@/components/homepage-featured";
import { HomepageLeadGrid } from "@/components/homepage-lead-grid";
import { HomepageVideo } from "@/components/homepage-video";
import { getPublicHomepage } from "@/lib/public-homepage";
/**
 * Homepage reads are still uncached: there is no homepage invalidation graph.
 * Next.js 16.3.1 here does not enable Cache Components, so this page would
 * otherwise statically prerender a PostgreSQL snapshot at build time.
 * Route-level force-dynamic is the isolated, first-class opt-out for `/`.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const homepage = await getPublicHomepage();

  if (!homepage.lead) {
    return (
      <div className="homepage">
        <div className="homepage__inner">
          <div className="homepage__empty">
            <p className="homepage__empty-kicker">Magazin</p>
            <h1 className="homepage__empty-title">Henüz yayınlanmış içerik bulunmuyor.</h1>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="homepage">
      <div className="homepage__inner">
        <div className="homepage__canvas">
          <div className="homepage__main">
            <HomepageLeadGrid homepage={homepage} />
            {homepage.video ? <HomepageVideo video={homepage.video} /> : null}
          </div>
          <HomepageFeatured stories={homepage.featured} />
        </div>
      </div>
    </div>
  );
}
