export const ENTITY_ROLE = {
  SUBJECT: "SUBJECT",
  SECONDARY: "SECONDARY",
  MENTIONED: "MENTIONED",
} as const;

export type EntityRole = (typeof ENTITY_ROLE)[keyof typeof ENTITY_ROLE];

export const ENTITY_ROLES = [
  ENTITY_ROLE.SUBJECT,
  ENTITY_ROLE.SECONDARY,
  ENTITY_ROLE.MENTIONED,
] as const;
