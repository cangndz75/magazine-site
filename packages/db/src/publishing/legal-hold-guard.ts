import {
  assertEditorialMutationAllowed,
} from "@magazine/domain";
import { unwrapPublishingDecision } from "./errors";

export function assertLockedEditorialMutationAllowed(item: {
  deletedAt: Date | string | null;
  legalHoldAt: Date | string | null;
}): void {
  unwrapPublishingDecision(assertEditorialMutationAllowed(item));
}
