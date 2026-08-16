import { eq, inArray } from "drizzle-orm";
import { selectEditorDisplayVersionId } from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionCategories,
  contentVersionAuthors,
  contentVersions,
} from "../schema/content";
import { categories } from "../schema/taxonomy";
import { authors } from "../schema/authors";
import type { DraftScalarFields } from "../publishing/update-draft-scalars";
import type { EditorVersionSummary } from "./types";

export type ArticleEditorRelationSummary = {
  categories: {
    id: string;
    name: string;
    slug: string;
    isPrimary: boolean;
  }[];
  authors: {
    id: string;
    displayName: string;
    slug: string;
  }[];
};

export type ArticleEditorModel = {
  contentItem: {
    id: string;
    slug: string;
    publicationStatus: "NEVER_PUBLISHED" | "PUBLISHED" | "UNPUBLISHED";
    publishedVersionId: string | null;
    draftVersionId: string | null;
    scheduledVersionId: string | null;
    scheduledAt: Date | null;
    scheduleGeneration: number;
    publishedAt: Date | null;
    publicDateModified: Date | null;
    updatedAt: Date;
  };
  displayVersionId: string | null;
  editableVersion: {
    id: string;
    versionNumber: number;
    workflowStatus: "DRAFT" | "IN_REVIEW" | "APPROVED";
    createdAt: Date;
    fields: DraftScalarFields;
    canEdit: boolean;
    concurrencyToken: Date;
    relations: ArticleEditorRelationSummary;
  } | null;
  publishedVersion: EditorVersionSummary | null;
  draftVersion: EditorVersionSummary | null;
  scheduledVersion: EditorVersionSummary | null;
};

export async function getArticleEditorModel(
  contentItemId: string,
): Promise<ArticleEditorModel | null> {
  const db = getDb();
  const [item] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId))
    .limit(1);

  if (!item || item.deletedAt !== null) {
    return null;
  }

  const pointerIds = [
    item.publishedVersionId,
    item.draftVersionId,
    item.scheduledVersionId,
  ].filter((id): id is string => id !== null);

  const summaryRows =
    pointerIds.length === 0
      ? []
      : await db
          .select({
            id: contentVersions.id,
            versionNumber: contentVersions.versionNumber,
            workflowStatus: contentVersions.workflowStatus,
            title: contentVersions.title,
          })
          .from(contentVersions)
          .where(inArray(contentVersions.id, pointerIds));

  const summaries = new Map(
    summaryRows.map((row) => [row.id, row satisfies EditorVersionSummary]),
  );

  const editableVersion = item.draftVersionId
    ? await loadEditableDraft(item.draftVersionId, item.updatedAt)
    : null;

  return {
    contentItem: {
      id: item.id,
      slug: item.slug,
      publicationStatus: item.publicationStatus,
      publishedVersionId: item.publishedVersionId,
      draftVersionId: item.draftVersionId,
      scheduledVersionId: item.scheduledVersionId,
      scheduledAt: item.scheduledAt,
      scheduleGeneration: item.scheduleGeneration,
      publishedAt: item.publishedAt,
      publicDateModified: item.publicDateModified,
      updatedAt: item.updatedAt,
    },
    displayVersionId: selectEditorDisplayVersionId(item),
    editableVersion,
    publishedVersion: item.publishedVersionId
      ? (summaries.get(item.publishedVersionId) ?? null)
      : null,
    draftVersion: item.draftVersionId
      ? (summaries.get(item.draftVersionId) ?? null)
      : null,
    scheduledVersion: item.scheduledVersionId
      ? (summaries.get(item.scheduledVersionId) ?? null)
      : null,
  };
}

async function loadEditableDraft(versionId: string, itemUpdatedAt: Date) {
  const db = getDb();
  const [version] = await db
    .select({
      id: contentVersions.id,
      versionNumber: contentVersions.versionNumber,
      workflowStatus: contentVersions.workflowStatus,
      title: contentVersions.title,
      subtitle: contentVersions.subtitle,
      excerpt: contentVersions.excerpt,
      seoTitle: contentVersions.seoTitle,
      seoDescription: contentVersions.seoDescription,
      canonicalUrl: contentVersions.canonicalUrl,
      robots: contentVersions.robots,
      credibility: contentVersions.credibility,
      credibilitySource: contentVersions.credibilitySource,
      source: contentVersions.source,
      sourceOrganization: contentVersions.sourceOrganization,
      sourceUrl: contentVersions.sourceUrl,
      syndicated: contentVersions.syndicated,
      isMaterialUpdate: contentVersions.isMaterialUpdate,
      createdAt: contentVersions.createdAt,
    })
    .from(contentVersions)
    .where(eq(contentVersions.id, versionId))
    .limit(1);

  if (!version) {
    return null;
  }

  return {
    id: version.id,
    versionNumber: version.versionNumber,
    workflowStatus: version.workflowStatus,
    createdAt: version.createdAt,
    fields: {
      title: version.title,
      subtitle: version.subtitle,
      excerpt: version.excerpt,
      seoTitle: version.seoTitle,
      seoDescription: version.seoDescription,
      canonicalUrl: version.canonicalUrl,
      robots: version.robots,
      credibility: version.credibility,
      credibilitySource: version.credibilitySource,
      source: version.source,
      sourceOrganization: version.sourceOrganization,
      sourceUrl: version.sourceUrl,
      syndicated: version.syndicated,
      isMaterialUpdate: version.isMaterialUpdate,
    },
    canEdit: version.workflowStatus === "DRAFT",
    concurrencyToken: itemUpdatedAt,
    relations: await loadRelationSummary(version.id),
  };
}

async function loadRelationSummary(
  versionId: string,
): Promise<ArticleEditorRelationSummary> {
  const db = getDb();
  const [categoryRows, authorRows] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        slug: categories.slug,
        isPrimary: contentVersionCategories.isPrimary,
      })
      .from(contentVersionCategories)
      .innerJoin(categories, eq(categories.id, contentVersionCategories.categoryId))
      .where(eq(contentVersionCategories.contentVersionId, versionId)),
    db
      .select({
        id: authors.id,
        displayName: authors.displayName,
        slug: authors.slug,
        sortOrder: contentVersionAuthors.sortOrder,
      })
      .from(contentVersionAuthors)
      .innerJoin(authors, eq(authors.id, contentVersionAuthors.authorId))
      .where(eq(contentVersionAuthors.contentVersionId, versionId))
      .orderBy(contentVersionAuthors.sortOrder),
  ]);

  return {
    categories: categoryRows,
    authors: authorRows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      slug: row.slug,
    })),
  };
}
