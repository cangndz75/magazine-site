import {
  evaluateMediaPublicEligibility,
  type CanonicalMediaRights,
  type MediaPublicEligibility,
  type MediaRenditionSurface,
} from "@magazine/domain";
import { resolvePublicMediaUrl } from "../public/resolve-public-media-url";
import {
  resolvePublicImageDelivery,
  type StoredMediaRendition,
} from "../media/image-delivery";
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
  row: { storageKey: string },
): string | null {
  return resolvePublicMediaUrl(mediaPublicBaseUrl, row.storageKey);
}

export function previewUrlForImageSurface(input: {
  mediaPublicBaseUrl: string | undefined;
  originalStorageKey: string;
  originalWidth: number | null;
  originalHeight: number | null;
  renditions?: readonly StoredMediaRendition[];
  surface: MediaRenditionSurface;
}): string | null {
  return resolvePublicImageDelivery(input).url;
}
