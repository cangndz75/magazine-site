export const STAFF_EMAIL_MAX_LENGTH = 254;

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}
