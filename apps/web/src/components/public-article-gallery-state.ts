export function galleryItemsIdentity(
  items: readonly { mediaId: string }[],
): string {
  return items.map((item) => item.mediaId).join(":");
}

export function currentGalleryIndex(index: number, total: number): number {
  if (total <= 0 || index < 0 || index >= total) {
    return 0;
  }
  return index;
}

export function stepGalleryIndex(
  index: number,
  total: number,
  delta: number,
): number {
  if (total <= 0) {
    return 0;
  }
  return (currentGalleryIndex(index, total) + delta + total) % total;
}
