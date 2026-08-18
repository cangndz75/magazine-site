import { CAPABILITY } from "@magazine/domain";
import {
  getEditorAuthorSummary,
  getEditorCategorySummary,
  listEditorContent,
  lookupEditorAuthors,
  lookupEditorCategories,
} from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import { queryScopeFromSession } from "@/lib/content/authorize";
import {
  ContentWorkspace,
  type ContentListItem,
} from "@/components/content-workspace";
import { parsePageSearchParams } from "@/lib/content/page-params";
import { mergeSelectedOption } from "@/lib/content/filter-query";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "İçerikler",
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

  const [result, categoryOptions, authorOptions, selectedCategory, selectedAuthor] =
    await Promise.all([
      listEditorContent(scope, {
        limit: filters.limit,
        cursor: filters.cursor,
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

  const items: ContentListItem[] = result.items.map((row) => ({
    ...row,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publicDateModified: row.publicDateModified?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <ContentWorkspace
      items={items}
      nextCursor={result.nextCursor}
      filters={filters}
      categoryOptions={mergeSelectedOption(selectedCategory, categoryOptions)}
      authorOptions={mergeSelectedOption(selectedAuthor, authorOptions)}
      selectedCategory={selectedCategory}
      selectedAuthor={selectedAuthor}
    />
  );
}
