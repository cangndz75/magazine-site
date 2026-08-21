import { assertExpectedUpdatedAt } from "../editor/concurrency";
import { canonicalizeContentSlug } from "./slug";
import { type PublishingDecision } from "./errors";
import { assertEditorialMutationAllowed } from "./invariants";

export type ChangeContentSlugPlan = {
  previousSlug: string;
  nextSlug: string;
  unchanged: boolean;
};

/**
 * Domain plan for an atomic current-slug mutation. History occupancy and
 * uniqueness against other items are enforced in the publishing transaction.
 */
export function decideChangeContentSlug(input: {
  requestedSlug: string;
  currentSlug: string;
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
  deletedAt: Date | string | null;
  legalHoldAt?: Date | string | null;
}): PublishingDecision<ChangeContentSlugPlan> {
  const allowed = assertEditorialMutationAllowed(input);
  if (!allowed.ok) {
    return allowed;
  }

  const nextSlug = canonicalizeContentSlug(input.requestedSlug);
  if (!nextSlug.ok) {
    return nextSlug;
  }

  const currentSlug = canonicalizeContentSlug(input.currentSlug);
  if (!currentSlug.ok) {
    return currentSlug;
  }

  const concurrency = assertExpectedUpdatedAt({
    currentUpdatedAt: input.currentUpdatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (!concurrency.ok) {
    return concurrency;
  }

  return {
    ok: true,
    value: {
      previousSlug: currentSlug.value,
      nextSlug: nextSlug.value,
      unchanged: currentSlug.value === nextSlug.value,
    },
  };
}

export function slugAdvisoryLockKeys(previousSlug: string, nextSlug: string): string[] {
  return [...new Set([previousSlug, nextSlug])].sort((left, right) =>
    left.localeCompare(right),
  );
}
