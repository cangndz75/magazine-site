import { hasCategoryScope, hasGlobalCategoryScope } from "../authorization";
import type { StaffRole } from "../staff-role";
import { STAFF_SCOPE_MODE, type StaffScopeMode } from "../staff-scope-mode";
import { PUBLISHING_ERROR, type PublishingDecision } from "../publishing/errors";

export type EditorStaffScope = {
  roles: readonly StaffRole[];
  scopeMode: StaffScopeMode;
  scopedCategoryIds: readonly string[];
};

export function staffHasUnrestrictedCategoryScope(
  scope: EditorStaffScope,
): boolean {
  return (
    hasGlobalCategoryScope(scope.roles) ||
    scope.scopeMode === STAFF_SCOPE_MODE.ALL
  );
}

export function canAccessEditorContentByPrimaryCategory(input: {
  roles: readonly StaffRole[];
  scopeMode: StaffScopeMode;
  scopedCategoryIds: readonly string[];
  primaryCategoryId: string | null;
}): boolean {
  if (staffHasUnrestrictedCategoryScope(input)) {
    return true;
  }

  if (input.primaryCategoryId === null) {
    return false;
  }

  return hasCategoryScope({
    roles: input.roles,
    scopeMode: input.scopeMode,
    scopedCategoryIds: input.scopedCategoryIds,
    categoryId: input.primaryCategoryId,
  });
}

/**
 * Review-queue access is decided from the IN_REVIEW version's primary category.
 * The currently published version's categories must not grant queue access.
 */
export function canAccessReviewQueueVersion(input: {
  roles: readonly StaffRole[];
  scopeMode: StaffScopeMode;
  scopedCategoryIds: readonly string[];
  reviewVersionPrimaryCategoryId: string | null;
}): boolean {
  return canAccessEditorContentByPrimaryCategory({
    roles: input.roles,
    scopeMode: input.scopeMode,
    scopedCategoryIds: input.scopedCategoryIds,
    primaryCategoryId: input.reviewVersionPrimaryCategoryId,
  });
}

export function assertCategoriesAssignableInScope(input: {
  roles: readonly StaffRole[];
  scopeMode: StaffScopeMode;
  scopedCategoryIds: readonly string[];
  categoryIds: readonly string[];
}): PublishingDecision<true> {
  if (staffHasUnrestrictedCategoryScope(input)) {
    return { ok: true, value: true };
  }

  for (const categoryId of input.categoryIds) {
    if (
      !hasCategoryScope({
        roles: input.roles,
        scopeMode: input.scopeMode,
        scopedCategoryIds: input.scopedCategoryIds,
        categoryId,
      })
    ) {
      return { ok: false, code: PUBLISHING_ERROR.CATEGORY_OUT_OF_SCOPE };
    }
  }

  return { ok: true, value: true };
}

export function assertSelectedCreatePrimaryCategory(input: {
  roles: readonly StaffRole[];
  scopeMode: StaffScopeMode;
  scopedCategoryIds: readonly string[];
  primaryCategoryId: string | null;
}): PublishingDecision<true> {
  if (staffHasUnrestrictedCategoryScope(input)) {
    return { ok: true, value: true };
  }

  if (input.primaryCategoryId === null) {
    return {
      ok: false,
      code: PUBLISHING_ERROR.SELECTED_SCOPE_PRIMARY_REQUIRED,
    };
  }

  return assertCategoriesAssignableInScope({
    ...input,
    categoryIds: [input.primaryCategoryId],
  });
}

/**
 * Authoritative post-lock category authorization.
 * Current item access is evaluated first so a payload cannot move an
 * out-of-scope article into an in-scope category.
 */
export function authorizeEditorContentMutation(input: {
  roles: readonly StaffRole[];
  scopeMode: StaffScopeMode;
  scopedCategoryIds: readonly string[];
  currentPrimaryCategoryId: string | null;
  nextCategoryIds?: readonly string[];
  nextPrimaryCategoryId?: string | null;
  requireSelectedPrimary?: boolean;
}): PublishingDecision<true> {
  if (
    !canAccessEditorContentByPrimaryCategory({
      roles: input.roles,
      scopeMode: input.scopeMode,
      scopedCategoryIds: input.scopedCategoryIds,
      primaryCategoryId: input.currentPrimaryCategoryId,
    })
  ) {
    return { ok: false, code: PUBLISHING_ERROR.CONTENT_NOT_FOUND };
  }

  if (input.requireSelectedPrimary) {
    const selectedPrimary = assertSelectedCreatePrimaryCategory({
      roles: input.roles,
      scopeMode: input.scopeMode,
      scopedCategoryIds: input.scopedCategoryIds,
      primaryCategoryId: input.nextPrimaryCategoryId ?? null,
    });
    if (!selectedPrimary.ok) {
      return selectedPrimary;
    }
  }

  if (input.nextCategoryIds === undefined) {
    return { ok: true, value: true };
  }

  return assertCategoriesAssignableInScope({
    roles: input.roles,
    scopeMode: input.scopeMode,
    scopedCategoryIds: input.scopedCategoryIds,
    categoryIds: input.nextCategoryIds,
  });
}

export function scopedCategoryIdsForQuery(
  scope: EditorStaffScope,
): readonly string[] | null {
  if (staffHasUnrestrictedCategoryScope(scope)) {
    return null;
  }

  return scope.scopedCategoryIds;
}
