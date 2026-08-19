import type { Metadata } from "next";
import { publicArticleCanonicalUrl } from "./public-site-url";

export type ArticleSeoInput = {
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  publishedAt: Date;
  publicDateModified: Date | null;
  hero: {
    url: string;
    width: number | null;
    height: number | null;
    altText: string | null;
  } | null;
  categories: Array<{
    name: string;
    slug: string;
    isPrimary: boolean;
  }>;
  authors: Array<{
    displayName: string;
    slug: string;
  }>;
};

export type PublicArticleSeo = {
  metadata: Metadata;
  jsonLd: Record<string, unknown> | null;
  jsonLdScript: string | null;
};

const NOT_FOUND_TITLE = "Yazı bulunamadı";
const NOT_FOUND_DESCRIPTION =
  "Bu yazı yayında değil veya böyle bir adres yok.";

function optionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function articleSeoDescription(
  article: Pick<ArticleSeoInput, "excerpt" | "subtitle">,
): string | undefined {
  return optionalText(article.excerpt) ?? optionalText(article.subtitle);
}

function primaryCategoryName(
  categories: ArticleSeoInput["categories"],
): string | undefined {
  return optionalText(categories.find((category) => category.isPrimary)?.name);
}

function authorNames(authors: ArticleSeoInput["authors"]): string[] {
  return authors
    .map((author) => optionalText(author.displayName))
    .filter((name): name is string => name !== undefined);
}

/**
 * JSON-LD must be safe inside <script type="application/ld+json">.
 * Escaping <, >, and & prevents breaking out of the script element.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildNotFoundArticleMetadata(): Metadata {
  return {
    title: NOT_FOUND_TITLE,
    description: NOT_FOUND_DESCRIPTION,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export function buildPublishedArticleJsonLd(
  article: ArticleSeoInput,
  siteUrl: string,
): Record<string, unknown> {
  const canonicalUrl = publicArticleCanonicalUrl(siteUrl, article.slug);
  const description = articleSeoDescription(article);
  const section = primaryCategoryName(article.categories);
  const names = authorNames(article.authors);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    url: canonicalUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    datePublished: article.publishedAt.toISOString(),
    inLanguage: "tr",
  };

  if (description) {
    jsonLd.description = description;
  }
  if (article.publicDateModified) {
    jsonLd.dateModified = article.publicDateModified.toISOString();
  }
  if (names.length > 0) {
    jsonLd.author = names.map((name) => ({
      "@type": "Person",
      name,
    }));
  }
  if (section) {
    jsonLd.articleSection = section;
  }
  if (article.hero?.url) {
    jsonLd.image = article.hero.url;
  }

  return jsonLd;
}

export function buildPublishedArticleMetadata(
  article: ArticleSeoInput,
  siteUrl: string,
): Metadata {
  const canonicalUrl = publicArticleCanonicalUrl(siteUrl, article.slug);
  const description = articleSeoDescription(article);
  const section = primaryCategoryName(article.categories);
  const names = authorNames(article.authors);
  const publishedTime = article.publishedAt.toISOString();
  const modifiedTime = article.publicDateModified?.toISOString();

  const openGraph: NonNullable<Metadata["openGraph"]> = {
    type: "article",
    title: article.title,
    url: canonicalUrl,
    publishedTime,
    locale: "tr_TR",
  };
  if (description) {
    openGraph.description = description;
  }
  if (modifiedTime) {
    openGraph.modifiedTime = modifiedTime;
  }
  if (names.length > 0) {
    openGraph.authors = names;
  }
  if (section) {
    openGraph.section = section;
  }
  if (article.hero?.url) {
    openGraph.images = [
      {
        url: article.hero.url,
        width: article.hero.width ?? undefined,
        height: article.hero.height ?? undefined,
        alt: optionalText(article.hero.altText),
      },
    ];
  }

  const twitter: NonNullable<Metadata["twitter"]> = {
    card: article.hero?.url ? "summary_large_image" : "summary",
    title: article.title,
  };
  if (description) {
    twitter.description = description;
  }
  if (article.hero?.url) {
    twitter.images = [article.hero.url];
  }

  const metadata: Metadata = {
    title: article.title,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph,
    twitter,
  };
  if (description) {
    metadata.description = description;
  }
  if (names.length > 0) {
    metadata.authors = names.map((name) => ({ name }));
  }
  if (section) {
    metadata.category = section;
  }

  return metadata;
}

/**
 * SEO for the public article route. A missing/non-public article yields
 * generic not-found metadata only — never article canonical/OG/JSON-LD.
 */
export function buildPublicArticleSeo(
  article: ArticleSeoInput | null,
  siteUrl: string,
): PublicArticleSeo {
  if (!article) {
    return {
      metadata: buildNotFoundArticleMetadata(),
      jsonLd: null,
      jsonLdScript: null,
    };
  }

  const jsonLd = buildPublishedArticleJsonLd(article, siteUrl);
  return {
    metadata: buildPublishedArticleMetadata(article, siteUrl),
    jsonLd,
    jsonLdScript: serializeJsonLd(jsonLd),
  };
}
