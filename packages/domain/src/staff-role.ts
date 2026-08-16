export const STAFF_ROLE = {
  SUPER_ADMIN: "SUPER_ADMIN",
  EDITOR: "EDITOR",
  AUTHOR: "AUTHOR",
} as const;

export type StaffRole = (typeof STAFF_ROLE)[keyof typeof STAFF_ROLE];

export const STAFF_ROLES = [
  STAFF_ROLE.SUPER_ADMIN,
  STAFF_ROLE.EDITOR,
  STAFF_ROLE.AUTHOR,
] as const;
