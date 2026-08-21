export const STAFF_SCOPE_MODE = {
  ALL: "ALL",
  SELECTED: "SELECTED",
} as const;

export type StaffScopeMode =
  (typeof STAFF_SCOPE_MODE)[keyof typeof STAFF_SCOPE_MODE];

export const STAFF_SCOPE_MODES = [
  STAFF_SCOPE_MODE.ALL,
  STAFF_SCOPE_MODE.SELECTED,
] as const;
