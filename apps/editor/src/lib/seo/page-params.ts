import {
  clampSeoInspectionLimit,
  decodeEditorListCursor,
  encodeEditorListCursor,
  isUuid,
  parsePublicationStatusFilter,
  parseSeoFindingFilter,
  parseSeoInspectionBoolean,
  parseSeoLegalWithdrawalFilter,
  sanitizeEditorSearch,
  parseDiscoverReadinessFilter,
  type DiscoverReadinessState,
  type EditorListCursor,
  type PublicationStatus,
  type SeoFindingFilter,
  type SeoLegalWithdrawalFilter,
} from "@magazine/domain";

export type SeoPageFilters = {
  limit: number;
  cursor: EditorListCursor | null;
  search: string | null;
  publicationStatus: PublicationStatus | undefined;
  notPublished: boolean;
  categoryId: string | undefined;
  indexable: boolean | undefined;
  missingSeoTitle: boolean;
  missingMetaDescription: boolean;
  missingHero: boolean;
  missingHeroAlt: boolean;
  findingFilter: SeoFindingFilter | undefined;
  legalWithdrawal: SeoLegalWithdrawalFilter | undefined;
  discoverReadiness: DiscoverReadinessState | undefined;
};

function firstString(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export function parseSeoPageSearchParams(
  params: Record<string, string | string[] | undefined>,
): SeoPageFilters {
  const limitRaw = firstString(params, "limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const cursorRaw = firstString(params, "cursor");
  const cursor = decodeEditorListCursor(cursorRaw) ?? null;
  const search = sanitizeEditorSearch(firstString(params, "q"));
  const publicationStatus = parsePublicationStatusFilter(
    firstString(params, "publicationStatus"),
  );
  const findingFilter = parseSeoFindingFilter(firstString(params, "findingFilter"));
  const legalWithdrawal = parseSeoLegalWithdrawalFilter(
    firstString(params, "legalWithdrawal"),
  );
  const discoverReadiness = parseDiscoverReadinessFilter(
    firstString(params, "discoverReadiness"),
  );
  const indexable = parseSeoInspectionBoolean(firstString(params, "indexable"));
  const notPublished = parseSeoInspectionBoolean(firstString(params, "notPublished"));
  const missingSeoTitle = parseSeoInspectionBoolean(
    firstString(params, "missingSeoTitle"),
  );
  const missingMetaDescription = parseSeoInspectionBoolean(
    firstString(params, "missingMetaDescription"),
  );
  const missingHero = parseSeoInspectionBoolean(firstString(params, "missingHero"));
  const missingHeroAlt = parseSeoInspectionBoolean(
    firstString(params, "missingHeroAlt"),
  );
  const categoryRaw = firstString(params, "categoryId");

  return {
    limit: clampSeoInspectionLimit(Number.isNaN(limit) ? undefined : limit),
    cursor,
    search,
    publicationStatus:
      publicationStatus === null || publicationStatus === undefined
        ? undefined
        : publicationStatus,
    notPublished: notPublished === true,
    categoryId: categoryRaw && isUuid(categoryRaw) ? categoryRaw : undefined,
    indexable: indexable === true || indexable === false ? indexable : undefined,
    missingSeoTitle: missingSeoTitle === true,
    missingMetaDescription: missingMetaDescription === true,
    missingHero: missingHero === true,
    missingHeroAlt: missingHeroAlt === true,
    findingFilter: findingFilter ?? undefined,
    legalWithdrawal: legalWithdrawal ?? undefined,
    discoverReadiness: discoverReadiness ?? undefined,
  };
}

export function seoListQueryString(filters: SeoPageFilters): string {
  const params = new URLSearchParams();
  if (filters.search) {
    params.set("q", filters.search);
  }
  if (filters.publicationStatus) {
    params.set("publicationStatus", filters.publicationStatus);
  }
  if (filters.notPublished) {
    params.set("notPublished", "1");
  }
  if (filters.categoryId) {
    params.set("categoryId", filters.categoryId);
  }
  if (filters.indexable === true) {
    params.set("indexable", "1");
  } else if (filters.indexable === false) {
    params.set("indexable", "0");
  }
  if (filters.missingSeoTitle) {
    params.set("missingSeoTitle", "1");
  }
  if (filters.missingMetaDescription) {
    params.set("missingMetaDescription", "1");
  }
  if (filters.missingHero) {
    params.set("missingHero", "1");
  }
  if (filters.missingHeroAlt) {
    params.set("missingHeroAlt", "1");
  }
  if (filters.findingFilter) {
    params.set("findingFilter", filters.findingFilter);
  }
  if (filters.legalWithdrawal) {
    params.set("legalWithdrawal", filters.legalWithdrawal);
  }
  if (filters.discoverReadiness) {
    params.set("discoverReadiness", filters.discoverReadiness);
  }
  if (filters.limit !== 20) {
    params.set("limit", String(filters.limit));
  }
  if (filters.cursor) {
    params.set(
      "cursor",
      encodeEditorListCursor({
        updatedAt: filters.cursor.updatedAt,
        id: filters.cursor.id,
      }),
    );
  }
  return params.toString();
}

export function seoPageHasFilters(filters: SeoPageFilters): boolean {
  return Boolean(
    filters.search ||
      filters.publicationStatus ||
      filters.notPublished ||
      filters.categoryId ||
      filters.indexable !== undefined ||
      filters.missingSeoTitle ||
      filters.missingMetaDescription ||
      filters.missingHero ||
      filters.missingHeroAlt ||
      filters.findingFilter ||
      filters.legalWithdrawal ||
      filters.discoverReadiness,
  );
}
