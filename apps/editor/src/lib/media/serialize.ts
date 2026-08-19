export function serializeMediaLibraryItem(item: {
  id: string;
  label: string;
  mediaType: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
  creatorName: string | null;
  creditLine: string | null;
  eligibility: {
    eligible: boolean;
    status: string;
    reasons: string[];
  };
  usageCount: number;
  createdAt: Date;
}) {
  return {
    ...item,
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
}) {
  return {
    ...inspector,
    createdAt: inspector.createdAt.toISOString(),
    rights: {
      ...inspector.rights,
      licenseStartsAt:
        inspector.rights.licenseStartsAt instanceof Date
          ? inspector.rights.licenseStartsAt.toISOString()
          : inspector.rights.licenseStartsAt,
      licenseExpiresAt:
        inspector.rights.licenseExpiresAt instanceof Date
          ? inspector.rights.licenseExpiresAt.toISOString()
          : inspector.rights.licenseExpiresAt,
    },
  };
}
