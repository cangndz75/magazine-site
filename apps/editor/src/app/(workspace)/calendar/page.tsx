import { CAPABILITY, FEATURE_FLAG_KEY } from "@magazine/domain";
import {
  getEditorAuthorSummary,
  getEditorCategorySummary,
  listEditorCalendarItems,
  lookupEditorAuthors,
  lookupEditorCategories,
} from "@magazine/db/editor";
import { isFeatureEnabled } from "@magazine/db/feature-controls";
import { notFound } from "next/navigation";
import { EditorialCalendarWorkspace } from "@/components/editorial-calendar-workspace";
import { requireCapability } from "@/lib/auth/authorization";
import { queryScopeFromSession } from "@/lib/content/authorize";
import { mergeSelectedOption } from "@/lib/content/filter-query";
import { parseCalendarPageSearchParams } from "@/lib/calendar/page-params";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Yayın Takvimi",
};

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.CONTENT_PUBLISH);
  if (!(await isFeatureEnabled(FEATURE_FLAG_KEY.EDITORIAL_CALENDAR))) {
    notFound();
  }

  const params = await searchParams;
  const filters = parseCalendarPageSearchParams(params);
  const scope = queryScopeFromSession(session);

  const [
    calendar,
    categoryOptions,
    authorOptions,
    selectedCategory,
    selectedAuthor,
  ] = await Promise.all([
    listEditorCalendarItems(scope, {
      start: filters.start,
      end: filters.end,
      categoryId: filters.categoryId,
      authorId: filters.authorId,
      contentKind: filters.contentKind,
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

  return (
    <EditorialCalendarWorkspace
      items={calendar.items.map((item) => ({
        contentItemId: item.contentItemId,
        slug: item.slug,
        contentKind: item.contentKind,
        publicationStatus: item.publicationStatus,
        workflowStatus: item.workflowStatus,
        scheduledVersionId: item.scheduledVersionId,
        scheduledAt: item.scheduledAt.toISOString(),
        scheduleGeneration: item.scheduleGeneration,
        title: item.title,
        primaryCategory: item.primaryCategory,
        authors: item.authors,
      }))}
      summary={calendar.summary}
      filters={filters}
      categoryOptions={mergeSelectedOption(selectedCategory, categoryOptions)}
      authorOptions={mergeSelectedOption(selectedAuthor, authorOptions)}
      selectedCategory={selectedCategory}
      selectedAuthor={selectedAuthor}
    />
  );
}
