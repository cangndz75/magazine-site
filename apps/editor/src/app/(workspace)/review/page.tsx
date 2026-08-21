import {
  CAPABILITY,
  summarizeListAttention,
  summarizeNewsroomReadiness,
} from "@magazine/domain";
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

  const items: ReviewQueueListItem[] = result.items.map((row) => {
    const legalHoldAt = row.legalHoldAt?.toISOString() ?? null;
    const retractedAt = row.retractedAt?.toISOString() ?? null;
    const takedownAt = row.takedownAt?.toISOString() ?? null;
    const readinessInput = {
      publicationStatus: row.publicationStatus,
      workflowStatus: row.workflowStatus,
      hasPrimaryCategory: row.primaryCategory !== null,
      authorCount: row.authors.length,
      legalHoldAt,
      retractedAt,
      takedownAt,
      changesRequestedNote: null,
      heroAssigned: true,
      heroRightsEligible: null,
    };

    return {
      contentItemId: row.contentItemId,
      versionId: row.versionId,
      versionNumber: row.versionNumber,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      workflowStatus: row.workflowStatus,
      publicationStatus: row.publicationStatus,
      createdAt: row.createdAt.toISOString(),
      latestSubmittedAt: row.latestSubmittedAt.toISOString(),
      reviewRound: row.reviewRound,
      publishedVersionId: row.publishedVersionId,
      scheduledVersionId: row.scheduledVersionId,
      scheduledAt: row.scheduledAt?.toISOString() ?? null,
      legalHoldAt,
      retractedAt,
      takedownAt,
      primaryCategory: row.primaryCategory,
      secondaryCategories: row.secondaryCategories,
      authors: row.authors,
      attention: summarizeListAttention(readinessInput),
      readiness: summarizeNewsroomReadiness(readinessInput),
    };
  });

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
