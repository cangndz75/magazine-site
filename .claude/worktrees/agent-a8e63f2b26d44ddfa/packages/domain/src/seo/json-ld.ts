import {
  resolvePublicPublisherIdentity,
  toNewsArticlePublisherOrganization,
  type PublicPublisherOrganization,
} from "./publisher";

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

export function jsonLdScriptIsSafe(serialized: string): boolean {
  return (
    !serialized.includes("</script") &&
    !serialized.includes("<script") &&
    !serialized.includes("<!--")
  );
}

export const NEWS_ARTICLE_JSON_LD_FIELD = {
  HEADLINE: "headline",
  URL: "url",
  MAIN_ENTITY_OF_PAGE: "mainEntityOfPage",
  DATE_PUBLISHED: "datePublished",
  DATE_MODIFIED: "dateModified",
  DESCRIPTION: "description",
  AUTHOR: "author",
  IMAGE: "image",
  ARTICLE_SECTION: "articleSection",
  PUBLISHER: "publisher",
} as const;

export type NewsArticleJsonLdField =
  (typeof NEWS_ARTICLE_JSON_LD_FIELD)[keyof typeof NEWS_ARTICLE_JSON_LD_FIELD];

const REQUIRED_NEWS_ARTICLE_FIELDS = [
  NEWS_ARTICLE_JSON_LD_FIELD.HEADLINE,
  NEWS_ARTICLE_JSON_LD_FIELD.URL,
  NEWS_ARTICLE_JSON_LD_FIELD.MAIN_ENTITY_OF_PAGE,
  NEWS_ARTICLE_JSON_LD_FIELD.DATE_PUBLISHED,
] as const;

const RECOMMENDED_NEWS_ARTICLE_FIELDS = [
  NEWS_ARTICLE_JSON_LD_FIELD.DESCRIPTION,
  NEWS_ARTICLE_JSON_LD_FIELD.DATE_MODIFIED,
  NEWS_ARTICLE_JSON_LD_FIELD.AUTHOR,
  NEWS_ARTICLE_JSON_LD_FIELD.IMAGE,
  NEWS_ARTICLE_JSON_LD_FIELD.ARTICLE_SECTION,
] as const;

export type NewsArticleStructuredDataInput = {
  suppressed: boolean;
  headline: string | null;
  canonicalUrl: string | null;
  datePublished: Date | string | null;
  dateModified: Date | string | null;
  description: string | null;
  authors: readonly string[];
  imageUrl: string | null;
  articleSection: string | null;
  publisherName: string | null;
  publisherUrl?: string | null;
  publisherLogoUrl?: string | null;
  inLanguage?: string | null;
};

export type NewsArticleJsonLd = {
  "@context": "https://schema.org";
  "@type": "NewsArticle";
  headline: string;
  url: string;
  mainEntityOfPage: {
    "@type": "WebPage";
    "@id": string;
  };
  datePublished: string;
  inLanguage?: string;
  dateModified?: string;
  description?: string;
  author?: Array<{ "@type": "Person"; name: string }>;
  image?: string;
  articleSection?: string;
  publisher?: PublicPublisherOrganization;
};

export type NewsArticleStructuredDataInspection = {
  wouldEmit: boolean;
  complete: boolean;
  presentFields: NewsArticleJsonLdField[];
  missingRequiredFields: NewsArticleJsonLdField[];
  missingRecommendedFields: NewsArticleJsonLdField[];
  publisherConfigured: boolean;
  scriptSafe: boolean;
};

function optionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isoDate(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

/**
 * Inspect whether current public data can produce the intended NewsArticle
 * JSON-LD. Missing publisher/person fields are reported, never fabricated.
 * Retraction/takedown callers must set suppressed=true.
 */
export function inspectNewsArticleStructuredData(
  input: NewsArticleStructuredDataInput,
): NewsArticleStructuredDataInspection {
  if (input.suppressed) {
    return {
      wouldEmit: false,
      complete: false,
      presentFields: [],
      missingRequiredFields: [...REQUIRED_NEWS_ARTICLE_FIELDS],
      missingRecommendedFields: [...RECOMMENDED_NEWS_ARTICLE_FIELDS],
      publisherConfigured:
        resolvePublicPublisherIdentity({
          name: input.publisherName,
          url: input.publisherUrl,
          logoUrl: input.publisherLogoUrl,
        }) !== null,
      scriptSafe: true,
    };
  }

  const headline = optionalText(input.headline);
  const canonicalUrl = optionalText(input.canonicalUrl);
  const datePublished = isoDate(input.datePublished);
  const dateModified = isoDate(input.dateModified);
  const description = optionalText(input.description);
  const authors = input.authors
    .map((name) => optionalText(name))
    .filter((name): name is string => name !== null);
  const imageUrl = optionalText(input.imageUrl);
  const articleSection = optionalText(input.articleSection);
  const publisher = resolvePublicPublisherIdentity({
    name: input.publisherName,
    url: input.publisherUrl,
    logoUrl: input.publisherLogoUrl,
  });
  const publisherName = publisher?.name ?? null;

  const present = new Set<NewsArticleJsonLdField>();
  if (headline) {
    present.add(NEWS_ARTICLE_JSON_LD_FIELD.HEADLINE);
  }
  if (canonicalUrl) {
    present.add(NEWS_ARTICLE_JSON_LD_FIELD.URL);
    present.add(NEWS_ARTICLE_JSON_LD_FIELD.MAIN_ENTITY_OF_PAGE);
  }
  if (datePublished) {
    present.add(NEWS_ARTICLE_JSON_LD_FIELD.DATE_PUBLISHED);
  }
  if (dateModified) {
    present.add(NEWS_ARTICLE_JSON_LD_FIELD.DATE_MODIFIED);
  }
  if (description) {
    present.add(NEWS_ARTICLE_JSON_LD_FIELD.DESCRIPTION);
  }
  if (authors.length > 0) {
    present.add(NEWS_ARTICLE_JSON_LD_FIELD.AUTHOR);
  }
  if (imageUrl) {
    present.add(NEWS_ARTICLE_JSON_LD_FIELD.IMAGE);
  }
  if (articleSection) {
    present.add(NEWS_ARTICLE_JSON_LD_FIELD.ARTICLE_SECTION);
  }
  if (publisherName) {
    present.add(NEWS_ARTICLE_JSON_LD_FIELD.PUBLISHER);
  }

  const missingRequiredFields = REQUIRED_NEWS_ARTICLE_FIELDS.filter(
    (field) => !present.has(field),
  );
  const missingRecommendedFields = RECOMMENDED_NEWS_ARTICLE_FIELDS.filter(
    (field) => !present.has(field),
  );

  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
  };
  if (headline) {
    payload.headline = headline;
  }
  if (canonicalUrl) {
    payload.url = canonicalUrl;
    payload.mainEntityOfPage = { "@type": "WebPage", "@id": canonicalUrl };
  }
  if (datePublished) {
    payload.datePublished = datePublished;
  }

  const serialized = serializeJsonLd(payload);

  return {
    wouldEmit: missingRequiredFields.length === 0,
    complete: missingRequiredFields.length === 0 && missingRecommendedFields.length === 0,
    presentFields: [
      ...REQUIRED_NEWS_ARTICLE_FIELDS,
      ...RECOMMENDED_NEWS_ARTICLE_FIELDS,
      NEWS_ARTICLE_JSON_LD_FIELD.PUBLISHER,
    ].filter((field) => present.has(field)),
    missingRequiredFields: [...missingRequiredFields],
    missingRecommendedFields: [...missingRecommendedFields],
    publisherConfigured: publisherName !== null,
    scriptSafe: jsonLdScriptIsSafe(serialized),
  };
}

/**
 * Single NewsArticle builder for public pages and inspection. Missing
 * publisher/person/address fields are omitted, never fabricated. Invalid
 * publisher URL/logo values are dropped field-by-field.
 */
export function buildNewsArticleJsonLd(
  input: NewsArticleStructuredDataInput,
): NewsArticleJsonLd | null {
  if (input.suppressed) {
    return null;
  }

  const inspection = inspectNewsArticleStructuredData(input);
  if (!inspection.wouldEmit) {
    return null;
  }

  const headline = optionalText(input.headline);
  const canonicalUrl = optionalText(input.canonicalUrl);
  const datePublished = isoDate(input.datePublished);
  if (!headline || !canonicalUrl || !datePublished) {
    return null;
  }

  const jsonLd: NewsArticleJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline,
    url: canonicalUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    datePublished,
  };

  const inLanguage = optionalText(input.inLanguage);
  if (inLanguage) {
    jsonLd.inLanguage = inLanguage;
  }

  const dateModified = isoDate(input.dateModified);
  if (dateModified) {
    jsonLd.dateModified = dateModified;
  }

  const description = optionalText(input.description);
  if (description) {
    jsonLd.description = description;
  }

  const authors = input.authors
    .map((name) => optionalText(name))
    .filter((name): name is string => name !== null);
  if (authors.length > 0) {
    jsonLd.author = authors.map((name) => ({
      "@type": "Person",
      name,
    }));
  }

  const imageUrl = optionalText(input.imageUrl);
  if (imageUrl) {
    jsonLd.image = imageUrl;
  }

  const articleSection = optionalText(input.articleSection);
  if (articleSection) {
    jsonLd.articleSection = articleSection;
  }

  const publisher = toNewsArticlePublisherOrganization(
    resolvePublicPublisherIdentity({
      name: input.publisherName,
      url: input.publisherUrl,
      logoUrl: input.publisherLogoUrl,
    }),
  );
  if (publisher) {
    jsonLd.publisher = publisher;
  }

  return jsonLd;
}
