export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_POLICY_ISSUE = {
  TOO_SHORT: "TOO_SHORT",
  TOO_LONG: "TOO_LONG",
} as const;

export type PasswordPolicyIssue =
  (typeof PASSWORD_POLICY_ISSUE)[keyof typeof PASSWORD_POLICY_ISSUE];

export function assertPasswordPolicy(
  password: string,
): { ok: true } | { ok: false; issue: PasswordPolicyIssue } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, issue: PASSWORD_POLICY_ISSUE.TOO_SHORT };
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, issue: PASSWORD_POLICY_ISSUE.TOO_LONG };
  }

  return { ok: true };
}
