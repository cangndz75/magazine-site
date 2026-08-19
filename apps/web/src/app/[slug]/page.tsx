import { notFound } from "next/navigation";
import { ArticleHeader } from "@/components/article-header";
import { ArticleHero } from "@/components/article-hero";
import { ArticleShare } from "@/components/article-share";
import { JsonLdScript } from "@/components/json-ld-script";
import { PublicArticleBody } from "@/components/public-article-body";
import { env } from "@/lib/env";
import { getPublicArticleBySlug } from "@/lib/public-article";
import { publicArticleCanonicalUrl } from "@/lib/seo/public-site-url";
import { buildPublicArticleSeo } from "@/lib/seo/article-seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublicArticleBySlug(slug);
  return buildPublicArticleSeo(article, env.SITE_URL).metadata;
}

export default async function PublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublicArticleBySlug(slug);
  if (!article) {
    notFound();
  }

  const { jsonLdScript } = buildPublicArticleSeo(article, env.SITE_URL);
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
    </div>
  );
}
