export const AUTHOR_ROLE = {
  AUTHOR: "AUTHOR",
  CONTRIBUTOR: "CONTRIBUTOR",
} as const;

export type AuthorRole = (typeof AUTHOR_ROLE)[keyof typeof AUTHOR_ROLE];

export const AUTHOR_ROLES = [
  AUTHOR_ROLE.AUTHOR,
  AUTHOR_ROLE.CONTRIBUTOR,
] as const;
