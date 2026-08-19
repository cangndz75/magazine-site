import { CAPABILITY } from "@magazine/domain";
import {
  getEditorAuthorSummary,
  getEditorCategorySummary,
  listReviewQueue,
  lookupEditorAuthors,
  lookupEditorCategories,
} from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import { queryScopeFromSession } from "@/lib/content/authorize";
import { parseReviewPageSearchParams } from "@/lib/content/review-page-params";
import { mergeSelectedOption } from "@/lib/content/filter-query";
import {
  ReviewQueueWorkspace,
  type ReviewQueueListItem,
} from "@/components/review-queue-workspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "İnceleme kuyruğu",
};

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.CONTENT_REVIEW);
  const params = await searchParams;
  const filters = parseReviewPageSearchParams(params);
  const scope = queryScopeFromSession(session);

  const [result, categoryOptions, authorOptions, selectedCategory, selectedAuthor] =
    await Promise.all([
      listReviewQueue(scope, {
        limit: filters.limit,
        cursor: filters.cursor,
        search: filters.search,
        publicationStatus: filters.publicationStatus,
        categoryId: filters.categoryId,
        authorId: filters.authorId,
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

  const items: ReviewQueueListItem[] = result.items.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    latestSubmittedAt: row.latestSubmittedAt.toISOString(),
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
  }));

  return (
    <ReviewQueueWorkspace
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
