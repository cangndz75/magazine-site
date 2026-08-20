import { notFound } from "next/navigation";
import { ArticleHeader } from "@/components/article-header";
import { ArticleHero } from "@/components/article-hero";
import { ArticleShare } from "@/components/article-share";
import { JsonLdScript } from "@/components/json-ld-script";
import { PublicArticleBody } from "@/components/public-article-body";
import { PublicArticleGallery } from "@/components/public-article-gallery";
import { PublicArticleLegalNotices } from "@/components/public-article-legal-notices";
import { PublicArticleVideos } from "@/components/public-article-videos";
import { PublicWithdrawnArticleShellView } from "@/components/public-withdrawn-article-shell";
import { env } from "@/lib/env";
import { getPublicArticlePageBySlug } from "@/lib/public-article";
import { publicArticleCanonicalUrl } from "@/lib/seo/public-site-url";
import { buildPublicArticlePageSeo } from "@/lib/seo/article-seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPublicArticlePageBySlug(slug);
  return buildPublicArticlePageSeo(page, env.SITE_URL).metadata;
}

export default async function PublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPublicArticlePageBySlug(slug);
  if (!page) {
    notFound();
  }

  if (page.status === "withdrawn") {
    return <PublicWithdrawnArticleShellView shell={page.shell} />;
  }

  const article = page.article;
  const { jsonLdScript } = buildPublicArticlePageSeo(page, env.SITE_URL);
  const canonicalUrl = publicArticleCanonicalUrl(env.SITE_URL, article.slug);

  return (
    <div className="public-article-page">
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
            items={article.gallery}
          />
        </div>
      ) : null}

      {article.videos.length > 0 ? (
        <div className="public-article-page__videos">
          <PublicArticleVideos videos={article.videos} />
        </div>
      ) : null}
    </div>
  );
}
