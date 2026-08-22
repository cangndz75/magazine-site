import type { SearchResultKind } from "@magazine/domain";

export const SEARCH_RESULT_TYPE_LABEL: Record<SearchResultKind, string> = {
  ARTICLE: "Haber",
  GALLERY: "Foto Galeri",
  ENTITY: "Profil",
};

export function searchResultTypeLabel(kind: SearchResultKind): string {
  return SEARCH_RESULT_TYPE_LABEL[kind];
}

export function formatSearchPublishedDate(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
}
