import { CAPABILITIES, type Capability } from "./capability";
import { ROLE_CAPABILITIES } from "./role-capabilities";
import { STAFF_ROLE, type StaffRole } from "./staff-role";
import { STAFF_SCOPE_MODE, type StaffScopeMode } from "./staff-scope-mode";

export function hasCapability(
  roles: readonly StaffRole[],
  capability: Capability,
): boolean {
  return roles.some((role) => ROLE_CAPABILITIES[role].includes(capability));
}

/**
 * Effective capabilities are derived only from assigned roles.
 * Callers must never accept client-supplied capability lists as authority.
 */
export function effectiveCapabilities(
  roles: readonly StaffRole[],
): Capability[] {
  const granted = new Set<Capability>();
  for (const role of roles) {
    for (const capability of ROLE_CAPABILITIES[role] ?? []) {
      granted.add(capability);
    }
  }
  return CAPABILITIES.filter((capability) => granted.has(capability));
}

export function hasGlobalCategoryScope(roles: readonly StaffRole[]): boolean {
  return roles.includes(STAFF_ROLE.SUPER_ADMIN);
}

export function hasCategoryScope(input: {
  roles: readonly StaffRole[];
  scopeMode: StaffScopeMode;
  scopedCategoryIds: readonly string[];
  categoryId: string;
}): boolean {
  if (hasGlobalCategoryScope(input.roles)) {
    return true;
  }

  if (input.scopeMode === STAFF_SCOPE_MODE.ALL) {
    return true;
  }

  return input.scopedCategoryIds.includes(input.categoryId);
}

export function canPerform(input: {
  roles: readonly StaffRole[];
  capability: Capability;
  scopeMode: StaffScopeMode;
  scopedCategoryIds: readonly string[];
  categoryId?: string;
}): boolean {
  if (!hasCapability(input.roles, input.capability)) {
    return false;
  }

  if (input.categoryId === undefined) {
    return true;
  }

  return hasCategoryScope({
    roles: input.roles,
    scopeMode: input.scopeMode,
    scopedCategoryIds: input.scopedCategoryIds,
    categoryId: input.categoryId,
  });
}
