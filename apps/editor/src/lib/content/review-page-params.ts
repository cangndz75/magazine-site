import {
  clampEditorListLimit,
  decodeEditorReviewQueueCursor,
  parsePublicationStatusFilter,
  sanitizeEditorSearch,
  isUuid,
  type PublicationStatus,
  type EditorReviewQueueCursor,
} from "@magazine/domain";

export type ReviewPageFilters = {
  limit: number;
  cursor: EditorReviewQueueCursor | null;
  search: string | null;
  publicationStatus: PublicationStatus | undefined;
  categoryId: string | undefined;
  authorId: string | undefined;
};

export function parseReviewPageSearchParams(
  params: Record<string, string | string[] | undefined>,
): ReviewPageFilters {
  const limitRaw = typeof params.limit === "string" ? params.limit : undefined;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const cursorRaw = typeof params.cursor === "string" ? params.cursor : undefined;
  const cursor = decodeEditorReviewQueueCursor(cursorRaw) ?? null;

  const qRaw = typeof params.q === "string" ? params.q : undefined;
  const search = sanitizeEditorSearch(qRaw);

  const pubRaw =
    typeof params.publicationStatus === "string"
      ? params.publicationStatus
      : undefined;
  const publicationStatus = parsePublicationStatusFilter(pubRaw);

  const catRaw =
    typeof params.categoryId === "string" ? params.categoryId : undefined;
  const categoryId = catRaw && isUuid(catRaw) ? catRaw : undefined;

  const authorRaw =
    typeof params.authorId === "string" ? params.authorId : undefined;
  const authorId = authorRaw && isUuid(authorRaw) ? authorRaw : undefined;

  return {
    limit: clampEditorListLimit(Number.isNaN(limit) ? undefined : limit),
    cursor,
    search,
    publicationStatus: publicationStatus === null ? undefined : publicationStatus,
    categoryId,
    authorId,
  };
}
