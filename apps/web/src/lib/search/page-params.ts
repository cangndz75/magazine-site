import {
  SEARCH_FILTER,
  SEARCH_QUERY_MIN_LENGTH,
  type SearchFilter,
} from "@magazine/domain";

export type PublicSearchPageParams = {
  q: string;
  filter: SearchFilter;
  cursor: string | null;
};

export function parsePublicSearchPageParams(
  params: Record<string, string | string[] | undefined>,
): PublicSearchPageParams {
  const rawQ = typeof params.q === "string" ? params.q : "";
  const rawTur = typeof params.tur === "string" ? params.tur : "";
  const rawCursor = typeof params.cursor === "string" ? params.cursor : null;

  let filter: SearchFilter = SEARCH_FILTER.ALL;
  switch (rawTur) {
    case "haber":
      filter = SEARCH_FILTER.ARTICLE;
      break;
    case "galeri":
      filter = SEARCH_FILTER.GALLERY;
      break;
    case "profil":
      filter = SEARCH_FILTER.ENTITY;
      break;
    default:
      filter = SEARCH_FILTER.ALL;
  }

  return {
    q: rawQ.trim(),
    filter,
    cursor: rawCursor,
  };
}

export function publicSearchFilterTur(filter: SearchFilter): string {
  switch (filter) {
    case SEARCH_FILTER.ARTICLE:
      return "haber";
    case SEARCH_FILTER.GALLERY:
      return "galeri";
    case SEARCH_FILTER.ENTITY:
      return "profil";
    default:
      return "tumu";
  }
}

export function isPublicSearchQueryReady(query: string): boolean {
  return query.trim().length >= SEARCH_QUERY_MIN_LENGTH;
}
