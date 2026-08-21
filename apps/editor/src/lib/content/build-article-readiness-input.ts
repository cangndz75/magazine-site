import type { ArticleReadinessInput } from "@magazine/domain";
import {
  editorDocumentToBody,
  type BodyEditorDocument,
} from "@/lib/content/body-editor-state";
import type { ArticleEditorFields } from "@/lib/content/article-editor-state";
import {
  getHeroMedia,
  type ArticleEditorMedia,
  type ArticleEditorRelations,
} from "@/lib/content/article-relation-state";

export type LinkSuggestionStats = {
  pendingCount: number;
  ambiguousCount: number;
};

export function toReadinessHero(
  hero: ArticleEditorMedia | null,
): ArticleReadinessInput["hero"] {
  if (!hero) {
    return null;
  }

  return {
    assigned: true,
    publicUrl: hero.previewUrl ?? null,
    altText: hero.altText,
    width: hero.width,
    height: hero.height,
    preferredRenditionAvailable: Boolean(hero.previewUrl),
    usedLegacyOriginalFallback: false,
    rightsEligible: hero.eligibility?.eligible ?? null,
    rightsStatus: hero.eligibility?.status ?? null,
    rightsReasons: hero.eligibility?.reasons ?? [],
  };
}

export function buildArticleReadinessInput(input: {
  trustedSiteUrl: string;
  editorOrigin: string;
  slug: string;
  publicationStatus: ArticleReadinessInput["publicationStatus"];
  publishedVersionId: string | null;
  publishedAt: string | null;
  publicDateModified?: string | null;
  workflowStatus: ArticleReadinessInput["workflowStatus"];
  legalHoldAt: string | null;
  retractedAt: string | null;
  takedownAt: string | null;
  fields: ArticleEditorFields;
  relations: ArticleEditorRelations;
  bodyDocument: BodyEditorDocument | null;
  bodyInspectable: boolean;
  fieldValidationOk: boolean;
  fieldValidationErrors: readonly string[];
  linkSuggestionStats?: LinkSuggestionStats;
}): ArticleReadinessInput {
  const hero = toReadinessHero(getHeroMedia(input.relations));

  return {
    trustedSiteUrl: input.trustedSiteUrl,
    editorOrigin: input.editorOrigin,
    slug: input.slug,
    publicationStatus: input.publicationStatus,
    publishedVersionId: input.publishedVersionId,
    publishedAt: input.publishedAt,
    publicDateModified: input.publicDateModified ?? null,
    workflowStatus: input.workflowStatus,
    legalHoldAt: input.legalHoldAt,
    retractedAt: input.retractedAt,
    takedownAt: input.takedownAt,
    title: input.fields.title,
    seoTitle: input.fields.seoTitle,
    seoDescription: input.fields.seoDescription,
    excerpt: input.fields.excerpt,
    subtitle: input.fields.subtitle,
    storedCanonicalUrl: input.fields.canonicalUrl,
    storedRobots: input.fields.robots,
    body: input.bodyDocument ? editorDocumentToBody(input.bodyDocument) : null,
    bodyInspectable: input.bodyInspectable,
    categories: input.relations.categories.map((item) => ({
      isPrimary: item.isPrimary,
      name: item.name,
    })),
    authors: input.relations.authors.map((item) => ({
      displayName: item.displayName,
    })),
    entities: input.relations.entities.map((item) => ({
      id: item.id,
      status: item.status,
    })),
    hero,
    fieldValidationOk: input.fieldValidationOk,
    fieldValidationErrors: input.fieldValidationErrors,
    pendingLinkSuggestionCount: input.linkSuggestionStats?.pendingCount ?? 0,
    ambiguousLinkSuggestionCount: input.linkSuggestionStats?.ambiguousCount ?? 0,
  };
}
