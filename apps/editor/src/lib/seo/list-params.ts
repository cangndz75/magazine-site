import {
  clampSeoInspectionLimit,
  decodeEditorListCursor,
  isUuid,
  parsePublicationStatusFilter,
  parseSeoFindingFilter,
  parseSeoInspectionBoolean,
  parseSeoLegalWithdrawalFilter,
  parseDiscoverReadinessFilter,
  sanitizeEditorSearch,
} from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";

export function parseSeoInspectionSearchParams(url: URL) {
  const limitRaw = url.searchParams.get("limit");
  const limit =
    limitRaw === null || limitRaw === ""
      ? undefined
      : Number.parseInt(limitRaw, 10);

  if (limitRaw !== null && limitRaw !== "" && Number.isNaN(limit)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const cursorRaw = url.searchParams.get("cursor") ?? undefined;
  const cursor = decodeEditorListCursor(cursorRaw);
  if (cursorRaw && !cursor) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const publicationStatus = parsePublicationStatusFilter(
    url.searchParams.get("publicationStatus") ?? undefined,
  );
  if (publicationStatus === null) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const findingFilter = parseSeoFindingFilter(
    url.searchParams.get("findingFilter") ?? undefined,
  );
  if (findingFilter === null) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const legalWithdrawal = parseSeoLegalWithdrawalFilter(
    url.searchParams.get("legalWithdrawal") ?? undefined,
  );
  if (legalWithdrawal === null) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const discoverReadiness = parseDiscoverReadinessFilter(
    url.searchParams.get("discoverReadiness") ?? undefined,
  );
  if (discoverReadiness === null) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const indexable = parseSeoInspectionBoolean(
    url.searchParams.get("indexable") ?? undefined,
  );
  const notPublished = parseSeoInspectionBoolean(
    url.searchParams.get("notPublished") ?? undefined,
  );
  const missingSeoTitle = parseSeoInspectionBoolean(
    url.searchParams.get("missingSeoTitle") ?? undefined,
  );
  const missingMetaDescription = parseSeoInspectionBoolean(
    url.searchParams.get("missingMetaDescription") ?? undefined,
  );
  const missingHero = parseSeoInspectionBoolean(
    url.searchParams.get("missingHero") ?? undefined,
  );
  const missingHeroAlt = parseSeoInspectionBoolean(
    url.searchParams.get("missingHeroAlt") ?? undefined,
  );

  if (
    indexable === null ||
    notPublished === null ||
    missingSeoTitle === null ||
    missingMetaDescription === null ||
    missingHero === null ||
    missingHeroAlt === null
  ) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const categoryId = url.searchParams.get("categoryId") ?? undefined;
  if (categoryId && !isUuid(categoryId)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return {
    limit: clampSeoInspectionLimit(limit),
    cursor,
    search: sanitizeEditorSearch(url.searchParams.get("q") ?? undefined),
    publicationStatus,
    notPublished: notPublished === true,
    categoryId,
    indexable,
    missingSeoTitle: missingSeoTitle === true,
    missingMetaDescription: missingMetaDescription === true,
    missingHero: missingHero === true,
    missingHeroAlt: missingHeroAlt === true,
    findingFilter,
    legalWithdrawal,
    discoverReadiness,
  };
}
