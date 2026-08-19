import type { EditorVideoAssetDetail, EditorVideoListItem } from "@magazine/db/editor";

const PICKER_OMIT = new Set([
  "submittedUrl",
  "rightsNote",
  "provenance",
  "description",
  "embedUrl",
  "storageKey",
]);

export function serializeVideoLibraryItem(item: EditorVideoListItem) {
  return {
    id: item.id,
    provider: item.provider,
    providerVideoId: item.providerVideoId,
    canonicalUrl: item.canonicalUrl,
    title: item.title,
    caption: item.caption,
    durationSeconds: item.durationSeconds,
    posterMediaId: item.posterMediaId,
    posterSource: item.posterSource,
    posterPreviewUrl: item.posterPreviewUrl,
    posterWidth: item.posterWidth,
    posterHeight: item.posterHeight,
    hasRightsNote: item.hasRightsNote,
    hasProvenance: item.hasProvenance,
    usageCount: item.usageCount,
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function serializeVideoPickerCard(
  item: ReturnType<typeof serializeVideoLibraryItem>,
) {
  return {
    id: item.id,
    provider: item.provider,
    providerVideoId: item.providerVideoId,
    canonicalUrl: item.canonicalUrl,
    title: item.title,
    durationSeconds: item.durationSeconds,
    posterPreviewUrl: item.posterPreviewUrl,
    posterSource: item.posterSource,
  };
}

export function serializeVideoInspector(detail: EditorVideoAssetDetail) {
  return {
    id: detail.id,
    provider: detail.provider,
    providerVideoId: detail.providerVideoId,
    canonicalUrl: detail.canonicalUrl,
    submittedUrl: detail.submittedUrl,
    title: detail.title,
    caption: detail.caption,
    description: detail.description,
    durationSeconds: detail.durationSeconds,
    posterMediaId: detail.posterMediaId,
    posterSource: detail.posterSource,
    posterPreviewUrl: detail.posterPreviewUrl,
    posterWidth: detail.posterWidth,
    posterHeight: detail.posterHeight,
    posterLabel: detail.posterLabel,
    posterEligibility: detail.posterEligibility,
    rightsNote: detail.rightsNote,
    provenance: detail.provenance,
    createdAt: detail.createdAt.toISOString(),
    updatedAt: detail.updatedAt.toISOString(),
    usages: detail.usages,
    usageCount: detail.usageCount,
  };
}

export function serializeDraftVideos(
  videos: readonly {
    id: string;
    provider: string;
    providerVideoId: string;
    canonicalUrl: string;
    title: string;
    caption: string | null;
    assetCaption?: string | null;
    durationSeconds: number | null;
    posterMediaId: string | null;
    posterPreviewUrl?: string | null;
    posterSource?: string | null;
    rightsNote?: string | null;
    provenance?: string | null;
    sortOrder: number;
  }[],
) {
  return videos.map((item) => ({
    id: item.id,
    provider: item.provider,
    providerVideoId: item.providerVideoId,
    canonicalUrl: item.canonicalUrl,
    title: item.title,
    caption: item.caption,
    assetCaption: item.assetCaption ?? null,
    durationSeconds: item.durationSeconds,
    posterMediaId: item.posterMediaId,
    posterPreviewUrl: item.posterPreviewUrl ?? null,
    posterSource: item.posterSource ?? "NONE",
    rightsNote: item.rightsNote ?? null,
    provenance: item.provenance ?? null,
    sortOrder: item.sortOrder,
  }));
}

export function pickerCardHasInternalFields(card: Record<string, unknown>): boolean {
  return Object.keys(card).some((key) => PICKER_OMIT.has(key));
}
