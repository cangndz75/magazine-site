import type { Metadata } from "next";
import {
  PUBLIC_ARTICLE_WITHDRAWAL_KIND,
  PUBLICATION_STATUS,
  buildNewsArticleJsonLd,
  resolveMissingPublicArticleIndexability,
  resolvePublicArticleCanonical,
  resolvePublicIndexability,
  resolvePublicMetadataDescription,
  resolvePublicMetadataTitle,
  resolveWithdrawnArticleIndexability,
  robotsMetadataForIndexability,
  serializeJsonLd,
  type PublicPublisherIdentity,
  type PublicWithdrawnArticleShell,
} from "@magazine/domain";
import { publicArticleCanonicalUrl } from "./public-site-url";

export type ArticleSeoInput = {
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  robots?: string | null;
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

export type PublicArticlePageSeoInput =
  | { status: "live"; article: ArticleSeoInput }
  | { status: "withdrawn"; shell: PublicWithdrawnArticleShell };

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

export function articleSeoTitle(
  article: Pick<ArticleSeoInput, "seoTitle" | "title">,
): string {
  return resolvePublicMetadataTitle({
    seoTitle: article.seoTitle,
    title: article.title,
  });
}

export function articleSeoDescription(
  article: Pick<ArticleSeoInput, "seoDescription" | "excerpt" | "subtitle">,
): string | undefined {
  return (
    resolvePublicMetadataDescription({
      seoDescription: article.seoDescription,
      excerpt: article.excerpt,
      subtitle: article.subtitle,
    }) ?? undefined
  );
}

function liveArticleIndexability(article: ArticleSeoInput) {
  return resolvePublicIndexability({
    publicationStatus: PUBLICATION_STATUS.PUBLISHED,
    publishedVersionId: "published",
    publishedAt: article.publishedAt,
    deletedAt: null,
    retractedAt: null,
    takedownAt: null,
    storedRobots: article.robots ?? null,
  });
}

function articleCanonicalUrl(article: ArticleSeoInput, siteUrl: string): string {
  const resolved = resolvePublicArticleCanonical({
    trustedSiteUrl: siteUrl,
    slug: article.slug,
    storedCanonicalUrl: article.canonicalUrl ?? null,
  });
  return resolved.url ?? publicArticleCanonicalUrl(siteUrl, article.slug);
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
 * Escaping is owned by the domain serializeJsonLd contract.
 */
export { serializeJsonLd };

export function buildNotFoundArticleMetadata(): Metadata {
  return {
    title: NOT_FOUND_TITLE,
    description: NOT_FOUND_DESCRIPTION,
    robots: robotsMetadataForIndexability(
      resolveMissingPublicArticleIndexability(),
    ),
  };
}

export function buildPublishedArticleJsonLd(
  article: ArticleSeoInput,
  siteUrl: string,
  publisher: PublicPublisherIdentity | null = null,
): Record<string, unknown> | null {
  const canonicalUrl = articleCanonicalUrl(article, siteUrl);
  const title = articleSeoTitle(article);
  const description = articleSeoDescription(article);
  const section = primaryCategoryName(article.categories);
  const names = authorNames(article.authors);

  return buildNewsArticleJsonLd({
    suppressed: false,
    headline: title,
    canonicalUrl,
    datePublished: article.publishedAt,
    dateModified: article.publicDateModified,
    description: description ?? null,
    authors: names,
    imageUrl: article.hero?.url ?? null,
    articleSection: section ?? null,
    publisherName: publisher?.name ?? null,
    publisherUrl: publisher?.url ?? null,
    publisherLogoUrl: publisher?.logoUrl ?? null,
    inLanguage: "tr",
  });
}

export function buildPublishedArticleMetadata(
  article: ArticleSeoInput,
  siteUrl: string,
): Metadata {
  const canonicalUrl = articleCanonicalUrl(article, siteUrl);
  const title = articleSeoTitle(article);
  const description = articleSeoDescription(article);
  const section = primaryCategoryName(article.categories);
  const names = authorNames(article.authors);
  const publishedTime = article.publishedAt.toISOString();
  const modifiedTime = article.publicDateModified?.toISOString();
  const indexability = liveArticleIndexability(article);

  const openGraph: NonNullable<Metadata["openGraph"]> = {
    type: "article",
    title,
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
    title,
  };
  if (description) {
    twitter.description = description;
  }
  if (article.hero?.url) {
    twitter.images = [article.hero.url];
  }

  const metadata: Metadata = {
    title,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: robotsMetadataForIndexability(indexability),
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

export function buildWithdrawnArticleMetadata(
  shell: PublicWithdrawnArticleShell,
  siteUrl: string,
): Metadata {
  const canonicalUrl = publicArticleCanonicalUrl(siteUrl, shell.slug);
  const isTakedown =
    shell.withdrawalKind === PUBLIC_ARTICLE_WITHDRAWAL_KIND.TAKEDOWN;
  const titleSuffix = isTakedown ? "Yayından kaldırıldı" : "Geri çekildi";
  const description =
    shell.publicNote?.trim() ||
    (isTakedown
      ? "Bu içerik yayından kaldırılmıştır."
      : "Bu yazı geri çekilmiştir.");

  return {
    title: `${shell.title} — ${titleSuffix}`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: robotsMetadataForIndexability(
      resolveWithdrawnArticleIndexability(shell.withdrawalKind),
    ),
  };
}

/**
 * SEO for the public article route. A missing/non-public article yields
 * generic not-found metadata only — never article canonical/OG/JSON-LD.
 */
export function buildPublicArticleSeo(
  article: ArticleSeoInput | null,
  siteUrl: string,
  publisher: PublicPublisherIdentity | null = null,
): PublicArticleSeo {
  if (!article) {
    return {
      metadata: buildNotFoundArticleMetadata(),
      jsonLd: null,
      jsonLdScript: null,
    };
  }

  const jsonLd = liveArticleIndexability(article).indexable
    ? buildPublishedArticleJsonLd(article, siteUrl, publisher)
    : null;
  return {
    metadata: buildPublishedArticleMetadata(article, siteUrl),
    jsonLd,
    jsonLdScript: jsonLd ? serializeJsonLd(jsonLd) : null,
  };
}

export function buildPublicArticlePageSeo(
  page: PublicArticlePageSeoInput | null,
  siteUrl: string,
  publisher: PublicPublisherIdentity | null = null,
): PublicArticleSeo {
  if (!page) {
    return {
      metadata: buildNotFoundArticleMetadata(),
      jsonLd: null,
      jsonLdScript: null,
    };
  }

  if (page.status === "withdrawn") {
    return {
      metadata: buildWithdrawnArticleMetadata(page.shell, siteUrl),
      jsonLd: null,
      jsonLdScript: null,
    };
  }

  return buildPublicArticleSeo(page.article, siteUrl, publisher);
}
