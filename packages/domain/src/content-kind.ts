export const CONTENT_KIND = {
  ARTICLE: "ARTICLE",
  GALLERY: "GALLERY",
} as const;

export type ContentKind = (typeof CONTENT_KIND)[keyof typeof CONTENT_KIND];

export const CONTENT_KINDS = [
  CONTENT_KIND.ARTICLE,
  CONTENT_KIND.GALLERY,
] as const;
