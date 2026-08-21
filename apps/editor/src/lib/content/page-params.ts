import {
  clampEditorListLimit,
  decodeEditorListCursor,
  parseNewsroomSort,
  parseNewsroomView,
  parsePublicationStatusFilter,
  parseWorkflowStatusFilter,
  sanitizeEditorSearch,
  isUuid,
  NEWSROOM_VIEW,
  type PublicationStatus,
  type WorkflowStatus,
  type EditorListCursor,
  type NewsroomSort,
  type NewsroomView,
} from "@magazine/domain";

export type ContentPageFilters = {
  limit: number;
  cursor: EditorListCursor | null;
  search: string | null;
  publicationStatus: PublicationStatus | undefined;
  workflowStatus: WorkflowStatus | undefined;
  categoryId: string | undefined;
  authorId: string | undefined;
  scheduledOnly: boolean;
  view: NewsroomView;
  sort: NewsroomSort;
};

export function parsePageSearchParams(
  params: Record<string, string | string[] | undefined>,
): ContentPageFilters {
  const limitRaw = typeof params.limit === "string" ? params.limit : undefined;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const cursorRaw = typeof params.cursor === "string" ? params.cursor : undefined;
  const cursor = decodeEditorListCursor(cursorRaw) ?? null;

  const qRaw = typeof params.q === "string" ? params.q : undefined;
  const search = sanitizeEditorSearch(qRaw);

  const pubRaw =
    typeof params.publicationStatus === "string"
      ? params.publicationStatus
      : undefined;
  const publicationStatus = parsePublicationStatusFilter(pubRaw);

  const wfRaw =
    typeof params.workflowStatus === "string"
      ? params.workflowStatus
      : undefined;
  const workflowStatus = parseWorkflowStatusFilter(wfRaw);

  const catRaw =
    typeof params.categoryId === "string" ? params.categoryId : undefined;
  const categoryId = catRaw && isUuid(catRaw) ? catRaw : undefined;

  const authorRaw =
    typeof params.authorId === "string" ? params.authorId : undefined;
  const authorId = authorRaw && isUuid(authorRaw) ? authorRaw : undefined;

  const scheduledRaw =
    typeof params.scheduledOnly === "string" ? params.scheduledOnly : undefined;
  const legacyScheduledView = scheduledRaw === "1" || scheduledRaw === "true";

  const viewRaw = typeof params.view === "string" ? params.view : undefined;
  const sortRaw = typeof params.sort === "string" ? params.sort : undefined;
  const view = parseNewsroomView(
    viewRaw ?? (legacyScheduledView ? NEWSROOM_VIEW.SCHEDULED : undefined),
  );

  return {
    limit: clampEditorListLimit(Number.isNaN(limit) ? undefined : limit),
    cursor,
    search,
    publicationStatus: publicationStatus === null ? undefined : publicationStatus,
    workflowStatus: workflowStatus === null ? undefined : workflowStatus,
    categoryId,
    authorId,
    scheduledOnly: false,
    view,
    sort: parseNewsroomSort(sortRaw),
  };
}
