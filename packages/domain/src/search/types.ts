export const SEARCH_RESULT_KIND = {
  ARTICLE: "ARTICLE",
  GALLERY: "GALLERY",
  ENTITY: "ENTITY",
} as const;

export type SearchResultKind =
  (typeof SEARCH_RESULT_KIND)[keyof typeof SEARCH_RESULT_KIND];

export const SEARCH_FILTER = {
  ALL: "ALL",
  ARTICLE: "ARTICLE",
  GALLERY: "GALLERY",
  ENTITY: "ENTITY",
} as const;

export type SearchFilter = (typeof SEARCH_FILTER)[keyof typeof SEARCH_FILTER];

export const SEARCH_QUERY_MIN_LENGTH = 2;
export const SEARCH_QUERY_MAX_LENGTH = 120;
export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 25;

export type SearchResultItem = {
  kind: SearchResultKind;
  id: string;
  title: string;
  excerpt: string | null;
  href: string;
  imageUrl: string | null;
  publishedAt: string | null;
  categoryLabel: string | null;
  matchedEntityLabel: string | null;
};

export type SearchResultsDto = {
  query: string;
  normalizedQuery: string;
  filter: SearchFilter;
  items: readonly SearchResultItem[];
  nextCursor: string | null;
};

export type SearchQueryErrorCode = "EMPTY" | "TOO_SHORT" | "TOO_LONG";

export type SearchQueryDecision =
  | { ok: true; normalizedQuery: string }
  | { ok: false; code: SearchQueryErrorCode };

export type SearchCursor = {
  publishedAt: string;
  id: string;
  kind: SearchResultKind;
};

export type EditorSearchResultItem = {
  contentItemId: string;
  contentKind: string;
  title: string;
  slug: string;
  publicationStatus: string;
  workflowStatus: string;
  editorHref: string;
};

export type EditorSearchResultsDto = {
  query: string;
  normalizedQuery: string;
  items: readonly EditorSearchResultItem[];
};
