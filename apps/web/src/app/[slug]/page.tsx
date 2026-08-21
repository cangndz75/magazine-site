import { resolvePublicArticleCanonical } from "@magazine/domain";
import { notFound, permanentRedirect } from "next/navigation";
import { AnalyticsArticleView } from "@/components/analytics/analytics-page-view";
import { ArticleHeader } from "@/components/article-header";
import { ArticleHero } from "@/components/article-hero";
import { ArticleShare } from "@/components/article-share";
import { JsonLdScript } from "@/components/json-ld-script";
import { PublicArticleBody } from "@/components/public-article-body";
import { PublicArticleEntities } from "@/components/public-article-entities";
import { PublicArticleGallery } from "@/components/public-article-gallery";
import { PublicArticleLegalNotices } from "@/components/public-article-legal-notices";
import { PublicArticleVideos } from "@/components/public-article-videos";
import { PublicWithdrawnArticleShellView } from "@/components/public-withdrawn-article-shell";
import { env } from "@/lib/env";
import { getPublicArticlePageBySlug } from "@/lib/public-article";
import { buildPublicArticlePageSeo } from "@/lib/seo/article-seo";
import { configuredPublicPublisher } from "@/lib/seo/publisher";
import { publicArticleCanonicalUrl } from "@/lib/seo/public-site-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPublicArticlePageBySlug(slug);
  if (page?.status === "redirect") {
    permanentRedirect(publicArticleCanonicalUrl(env.SITE_URL, page.toSlug));
  }
  return buildPublicArticlePageSeo(
    page,
    env.SITE_URL,
    configuredPublicPublisher(),
  ).metadata;
}

export default async function PublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPublicArticlePageBySlug(slug);
  if (page?.status === "redirect") {
    permanentRedirect(publicArticleCanonicalUrl(env.SITE_URL, page.toSlug));
  }
  if (!page) {
    notFound();
  }

  if (page.status === "withdrawn") {
    return <PublicWithdrawnArticleShellView shell={page.shell} />;
  }

  const article = page.article;
  const { jsonLdScript } = buildPublicArticlePageSeo(
    page,
    env.SITE_URL,
    configuredPublicPublisher(),
  );
  const canonicalUrl =
    resolvePublicArticleCanonical({
      trustedSiteUrl: env.SITE_URL,
      slug: article.slug,
      storedCanonicalUrl: article.canonicalUrl,
    }).url ?? publicArticleCanonicalUrl(env.SITE_URL, article.slug);

  return (
    <div className="public-article-page">
      <AnalyticsArticleView
        contentItemId={article.id}
        publicSlug={article.slug}
        analyticsContext={article.analyticsContext ?? ""}
      />
      {jsonLdScript ? <JsonLdScript json={jsonLdScript} /> : null}

      <div className="public-article-page__text">
        <ArticleHeader
          title={article.title}
          subtitle={article.subtitle}
          publishedAt={article.publishedAt}
          publicDateModified={article.publicDateModified}
          categories={article.categories}
          authors={article.authors}
        />
        <ArticleShare title={article.title} url={canonicalUrl} />
        <PublicArticleLegalNotices notices={article.legalNotices} />
        {article.entities.length > 0 ? (
          <PublicArticleEntities entities={article.entities} />
        ) : null}
      </div>

      {article.hero ? (
        <div className="public-article-page__hero">
          <ArticleHero hero={article.hero} title={article.title} />
        </div>
      ) : null}

      <div className="public-article-page__body">
        <article>
          <PublicArticleBody body={article.body} />
        </article>
      </div>

      {article.gallery.length > 0 ? (
        <div className="public-article-page__gallery">
          <PublicArticleGallery
            key={article.gallery.map((item) => item.mediaId).join(":")}
            contentItemId={article.id}
            analyticsContext={article.analyticsContext ?? ""}
            items={article.gallery}
          />
        </div>
      ) : null}

      {article.videos.length > 0 ? (
        <div className="public-article-page__videos">
          <PublicArticleVideos
            contentItemId={article.id}
            analyticsContext={article.analyticsContext ?? ""}
            videos={article.videos}
          />
        </div>
      ) : null}
    </div>
  );
}
