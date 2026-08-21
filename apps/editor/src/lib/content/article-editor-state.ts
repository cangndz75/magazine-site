import {
  CREDIBILITY_VALUES,
  parseSeoRobotsOverride,
  resolvePublicArticleCanonical,
  SEO_ROBOTS_DIRECTIVE,
  type Credibility,
} from "@magazine/domain";
import { presentCanonicalRejection } from "@/lib/seo/presentation";

export type ArticleEditorFields = {
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  credibility: Credibility | null;
  credibilitySource: string | null;
  source: string | null;
  sourceOrganization: string | null;
  sourceUrl: string | null;
  syndicated: boolean;
  isMaterialUpdate: boolean;
};

export type ArticleEditorValidation = {
  ok: boolean;
  errors: Partial<Record<keyof ArticleEditorFields, string>>;
};

function normalizeNullableText(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeUrl(value: string | null): string | null {
  const trimmed = normalizeNullableText(value);
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return trimmed;
    }
    return url.toString();
  } catch {
    return trimmed;
  }
}

function normalizeRobots(value: string | null): string | null {
  return parseSeoRobotsOverride(value).directive === SEO_ROBOTS_DIRECTIVE.NOINDEX
    ? "noindex"
    : null;
}

export function normalizeArticleEditorFields(
  fields: ArticleEditorFields,
): ArticleEditorFields {
  return {
    title: fields.title.trim(),
    subtitle: normalizeNullableText(fields.subtitle),
    excerpt: normalizeNullableText(fields.excerpt),
    seoTitle: normalizeNullableText(fields.seoTitle),
    seoDescription: normalizeNullableText(fields.seoDescription),
    canonicalUrl: normalizeUrl(fields.canonicalUrl),
    robots: normalizeRobots(fields.robots),
    credibility: fields.credibility,
    credibilitySource: normalizeNullableText(fields.credibilitySource),
    source: normalizeNullableText(fields.source),
    sourceOrganization: normalizeNullableText(fields.sourceOrganization),
    sourceUrl: normalizeUrl(fields.sourceUrl),
    syndicated: fields.syndicated,
    isMaterialUpdate: fields.isMaterialUpdate,
  };
}

export function articleEditorFieldsEqual(
  left: ArticleEditorFields,
  right: ArticleEditorFields,
): boolean {
  const a = normalizeArticleEditorFields(left);
  const b = normalizeArticleEditorFields(right);
  return JSON.stringify(a) === JSON.stringify(b);
}

export type ArticleEditorValidationContext = {
  trustedSiteUrl?: string;
  editorOrigin?: string | null;
  slug?: string;
};

export function validateArticleEditorFields(
  fields: ArticleEditorFields,
  context?: ArticleEditorValidationContext,
): ArticleEditorValidation {
  const normalized = normalizeArticleEditorFields(fields);
  const errors: ArticleEditorValidation["errors"] = {};

  if (normalized.title.length === 0) {
    errors.title = "Başlık zorunlu.";
  }

  if (fields.credibility !== null && !CREDIBILITY_VALUES.includes(fields.credibility)) {
    errors.credibility = "Geçersiz doğruluk durumu.";
  }

  for (const key of ["canonicalUrl", "sourceUrl"] as const) {
    const raw = normalizeNullableText(fields[key]);
    if (!raw) {
      continue;
    }
    try {
      const url = new URL(raw);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors[key] = "URL http veya https olmalı.";
      }
    } catch {
      errors[key] = "Geçerli bir URL girin.";
    }
  }

  if (
    !errors.canonicalUrl &&
    context?.trustedSiteUrl &&
    context.slug &&
    normalizeNullableText(fields.canonicalUrl)
  ) {
    const resolved = resolvePublicArticleCanonical({
      trustedSiteUrl: context.trustedSiteUrl,
      slug: context.slug,
      storedCanonicalUrl: fields.canonicalUrl,
      editorOrigin: context.editorOrigin,
    });
    if (resolved.rejection) {
      errors.canonicalUrl = presentCanonicalRejection(resolved.rejection);
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}

export const CREDIBILITY_LABELS: Record<Credibility, string> = {
  CLAIM: "İddia",
  CONFIRMED: "Doğrulandı",
  DENIED: "Yalanlandı",
};

export const ARTICLE_EDITOR_EMPTY_FIELDS: ArticleEditorFields = {
  title: "",
  subtitle: null,
  excerpt: null,
  seoTitle: null,
  seoDescription: null,
  canonicalUrl: null,
  robots: null,
  credibility: null,
  credibilitySource: null,
  source: null,
  sourceOrganization: null,
  sourceUrl: null,
  syndicated: false,
  isMaterialUpdate: false,
};
