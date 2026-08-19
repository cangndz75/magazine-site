import type { ArticleEditorGalleryAttachment } from "@magazine/db/publishing";

export function serializeDraftGallery(
  gallery: readonly ArticleEditorGalleryAttachment[],
) {
  return gallery.map((item) => ({
    id: item.id,
    label: item.label,
    mediaType: item.mediaType,
    width: item.width,
    height: item.height,
    role: item.role,
    sortOrder: item.sortOrder,
    caption: item.caption,
    altText: item.altText,
    credit: item.credit,
    previewUrl: item.previewUrl,
    creatorName: item.creatorName,
    creditLine: item.creditLine,
    eligibility: item.eligibility,
  }));
}
