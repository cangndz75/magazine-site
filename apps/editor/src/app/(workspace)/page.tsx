import {
  CAPABILITY,
  hasCapability,
  summarizeListAttention,
  summarizeNewsroomReadiness,
} from "@magazine/domain";
import {
  getEditorAuthorSummary,
  getEditorCategorySummary,
  getNewsroomViewCounts,
  listEditorContent,
  lookupEditorAuthors,
  lookupEditorCategories,
} from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import { queryScopeFromSession } from "@/lib/content/authorize";
import {
  NewsroomDesk,
  type NewsroomListItem,
} from "@/components/newsroom-desk";
import { parsePageSearchParams } from "@/lib/content/page-params";
import { mergeSelectedOption } from "@/lib/content/filter-query";
import { toNewsroomReadinessInput } from "@/lib/content/newsroom-item";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Haber Masası",
};

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.CONTENT_READ);
  const params = await searchParams;
  const filters = parsePageSearchParams(params);
  const scope = queryScopeFromSession(session);

  const listFilters = {
    limit: filters.limit,
    cursor: filters.cursor,
    search: filters.search,
    publicationStatus: filters.publicationStatus,
    workflowStatus: filters.workflowStatus,
    categoryId: filters.categoryId,
    authorId: filters.authorId,
    scheduledOnly: filters.scheduledOnly,
    view: filters.view,
    sort: filters.sort,
  };

  const [
    result,
    viewCounts,
    categoryOptions,
    authorOptions,
    selectedCategory,
    selectedAuthor,
  ] = await Promise.all([
    listEditorContent(scope, listFilters),
    getNewsroomViewCounts(scope, {
      search: filters.search,
      publicationStatus: filters.publicationStatus,
      workflowStatus: filters.workflowStatus,
      categoryId: filters.categoryId,
      authorId: filters.authorId,
      scheduledOnly: filters.scheduledOnly,
    }),
    lookupEditorCategories({
      scopedCategoryIds: scope.scopedCategoryIds,
    }),
    lookupEditorAuthors({}),
    filters.categoryId
      ? getEditorCategorySummary(filters.categoryId, scope.scopedCategoryIds)
      : Promise.resolve(null),
    filters.authorId
      ? getEditorAuthorSummary(filters.authorId)
      : Promise.resolve(null),
  ]);

  const items: NewsroomListItem[] = result.items.map((row) => {
    const serialized = {
      id: row.id,
      slug: row.slug,
      publicationStatus: row.publicationStatus,
      displayVersion: row.displayVersion,
      publishedVersionId: row.publishedVersionId,
      draftVersionId: row.draftVersionId,
      scheduledVersionId: row.scheduledVersionId,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      publicDateModified: row.publicDateModified?.toISOString() ?? null,
      primaryCategory: row.primaryCategory,
      authors: row.authors,
      updatedAt: row.updatedAt.toISOString(),
      legalHoldAt: row.legalHoldAt?.toISOString() ?? null,
      retractedAt: row.retractedAt?.toISOString() ?? null,
      takedownAt: row.takedownAt?.toISOString() ?? null,
      changesRequestedNote: row.changesRequestedNote,
      entityCount: row.entityCount,
      heroThumbnail: row.heroThumbnail,
    };

    const readinessInput = toNewsroomReadinessInput(serialized);

    return {
      ...serialized,
      attention: summarizeListAttention(readinessInput),
      readiness: summarizeNewsroomReadiness(readinessInput),
    };
  });

  return (
    <NewsroomDesk
      items={items}
      nextCursor={result.nextCursor}
      filters={filters}
      viewCounts={viewCounts}
      categoryOptions={mergeSelectedOption(selectedCategory, categoryOptions)}
      authorOptions={mergeSelectedOption(selectedAuthor, authorOptions)}
      selectedCategory={selectedCategory}
      selectedAuthor={selectedAuthor}
      canCreate={hasCapability(session.roles, CAPABILITY.CONTENT_CREATE)}
    />
  );
}
