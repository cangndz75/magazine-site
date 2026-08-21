export type CategoryAssignment = {
  isPrimary: boolean;
};

export const PRIMARY_CATEGORY_ISSUE = {
  REQUIRED: "PRIMARY_CATEGORY_REQUIRED",
  MULTIPLE: "MULTIPLE_PRIMARY_CATEGORIES",
} as const;

export type PrimaryCategoryIssue =
  (typeof PRIMARY_CATEGORY_ISSUE)[keyof typeof PRIMARY_CATEGORY_ISSUE];

export function countPrimaryCategories(
  categories: readonly CategoryAssignment[],
): number {
  return categories.filter((category) => category.isPrimary).length;
}

export function assertPublishablePrimaryCategory(
  categories: readonly CategoryAssignment[],
): { ok: true } | { ok: false; issue: PrimaryCategoryIssue } {
  const primaryCount = countPrimaryCategories(categories);

  if (primaryCount === 0) {
    return { ok: false, issue: PRIMARY_CATEGORY_ISSUE.REQUIRED };
  }

  if (primaryCount > 1) {
    return { ok: false, issue: PRIMARY_CATEGORY_ISSUE.MULTIPLE };
  }

  return { ok: true };
}
