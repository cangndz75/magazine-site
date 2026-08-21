import type { PublicHomepageAnalyticsPlacement } from "@magazine/db/public";
import type { AnalyticsPlacement } from "@magazine/domain/analytics-client";

export function findHomepagePlacement(
  placements: readonly PublicHomepageAnalyticsPlacement[],
  input: {
    contentItemId: string;
    placement?: AnalyticsPlacement;
    position?: number;
  },
): PublicHomepageAnalyticsPlacement | undefined {
  return placements.find((placement) => {
    if (placement.contentItemId !== input.contentItemId) {
      return false;
    }
    if (input.placement && placement.placement !== input.placement) {
      return false;
    }
    if (input.position !== undefined && placement.position !== input.position) {
      return false;
    }
    return true;
  });
}
