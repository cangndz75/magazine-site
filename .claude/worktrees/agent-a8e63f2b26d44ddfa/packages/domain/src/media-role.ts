export const MEDIA_ROLE = {
  HERO: "HERO",
  INLINE: "INLINE",
  GALLERY: "GALLERY",
} as const;

export type MediaRole = (typeof MEDIA_ROLE)[keyof typeof MEDIA_ROLE];

export const MEDIA_ROLES = [
  MEDIA_ROLE.HERO,
  MEDIA_ROLE.INLINE,
  MEDIA_ROLE.GALLERY,
] as const;
