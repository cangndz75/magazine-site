export function serializeMediaLibraryItem(item: {
  id: string;
  label: string;
  mediaType: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
  creatorName: string | null;
  sourceName: string | null;
  creditLine: string | null;
  licenseExpiresAt: Date | null;
  eligibility: {
    eligible: boolean;
    status: string;
    reasons: string[];
  };
  usageCount: number;
  createdAt: Date;
}) {
  return {
    id: item.id,
    label: item.label,
    mediaType: item.mediaType,
    mimeType: item.mimeType,
    width: item.width,
    height: item.height,
    previewUrl: item.previewUrl,
    creatorName: item.creatorName,
    sourceName: item.sourceName,
    creditLine: item.creditLine,
    licenseExpiresAt: item.licenseExpiresAt?.toISOString() ?? null,
    eligibility: item.eligibility,
    usageCount: item.usageCount,
    createdAt: item.createdAt.toISOString(),
  };
}

export function serializeMediaInspector(inspector: {
  id: string;
  label: string;
  mediaType: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  previewUrl: string | null;
  createdAt: Date;
  rights: Record<string, unknown>;
  eligibility: {
    eligible: boolean;
    status: string;
    reasons: string[];
  };
  usages: unknown[];
  usageCount: number;
  renditions: Array<{ variant: string; width: number; height: number }>;
}) {
  return {
    id: inspector.id,
    label: inspector.label,
    mediaType: inspector.mediaType,
    mimeType: inspector.mimeType,
    width: inspector.width,
    height: inspector.height,
    byteSize: inspector.byteSize,
    previewUrl: inspector.previewUrl,
    createdAt: inspector.createdAt.toISOString(),
    rights: {
      sourceKind: inspector.rights.sourceKind,
      sourceName: inspector.rights.sourceName,
      creatorName: inspector.rights.creatorName,
      rightsHolder: inspector.rights.rightsHolder,
      licenseType: inspector.rights.licenseType,
      licenseReference: inspector.rights.licenseReference,
      licenseNote: inspector.rights.licenseNote,
      licenseStartsAt:
        inspector.rights.licenseStartsAt instanceof Date
          ? inspector.rights.licenseStartsAt.toISOString()
          : inspector.rights.licenseStartsAt,
      licenseExpiresAt:
        inspector.rights.licenseExpiresAt instanceof Date
          ? inspector.rights.licenseExpiresAt.toISOString()
          : inspector.rights.licenseExpiresAt,
      creditLine: inspector.rights.creditLine,
      usageRestriction: inspector.rights.usageRestriction,
      territoryRestriction: inspector.rights.territoryRestriction,
    },
    eligibility: inspector.eligibility,
    usages: inspector.usages,
    usageCount: inspector.usageCount,
    renditions: inspector.renditions,
  };
}
