import {
  evaluateMediaPublicEligibility,
  type CanonicalMediaRights,
  type MediaPublicEligibility,
} from "@magazine/domain";
import { resolvePublicMediaUrl } from "../public/resolve-public-media-url";
import type { media } from "../schema/media";

export type EditorMediaRightsFields = CanonicalMediaRights & {
  licenseNote: string | null;
};

export function rightsFromMediaRow(row: typeof media.$inferSelect): EditorMediaRightsFields {
  return {
    sourceKind: row.sourceKind,
    sourceName: row.sourceName,
    creatorName: row.creatorName,
    rightsHolder: row.rightsHolder,
    licenseType: row.licenseType,
    licenseReference: row.licenseReference,
    licenseNote: row.licenseNote,
    licenseStartsAt: row.licenseStartsAt,
    licenseExpiresAt: row.licenseExpiresAt,
    creditLine: row.creditLine,
    usageRestriction: row.usageRestriction,
    territoryRestriction: row.territoryRestriction,
  };
}

export function eligibilityForRow(
  row: typeof media.$inferSelect,
  now: Date,
): MediaPublicEligibility {
  return evaluateMediaPublicEligibility(rightsFromMediaRow(row), now);
}

export function previewUrlForRow(
  mediaPublicBaseUrl: string | undefined,
  row: typeof media.$inferSelect,
): string | null {
  return resolvePublicMediaUrl(mediaPublicBaseUrl, row.storageKey);
}
