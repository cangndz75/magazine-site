export const STAFF_STATUS = {
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
} as const;

export type StaffStatus = (typeof STAFF_STATUS)[keyof typeof STAFF_STATUS];

export const STAFF_STATUSES = [
  STAFF_STATUS.ACTIVE,
  STAFF_STATUS.DISABLED,
] as const;
