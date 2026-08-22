import type { PublicArticleGalleryItem } from "@magazine/db/public";

export type PhotoGalleryLayoutSingle = {
  type: "single";
  item: PublicArticleGalleryItem;
  index: number;
};

export type PhotoGalleryLayoutPair = {
  type: "pair";
  items: [PublicArticleGalleryItem, PublicArticleGalleryItem];
  indices: [number, number];
};

export type PhotoGalleryLayoutBlock = PhotoGalleryLayoutSingle | PhotoGalleryLayoutPair;

function isLandscape(item: PublicArticleGalleryItem): boolean {
  const width = item.width ?? 1200;
  const height = item.height ?? 800;
  return width >= height;
}

export function canPairPhotoGalleryItems(
  left: PublicArticleGalleryItem,
  right: PublicArticleGalleryItem,
): boolean {
  return isLandscape(left) && isLandscape(right);
}

/**
 * Preserves exact DB order while grouping consecutive landscape frames into pairs.
 */
export function buildPhotoGalleryLayout(
  items: readonly PublicArticleGalleryItem[],
): PhotoGalleryLayoutBlock[] {
  const blocks: PhotoGalleryLayoutBlock[] = [];
  let index = 0;

  while (index < items.length) {
    const current = items[index]!;
    const next = items[index + 1];
    if (next && canPairPhotoGalleryItems(current, next)) {
      blocks.push({
        type: "pair",
        items: [current, next],
        indices: [index, index + 1],
      });
      index += 2;
      continue;
    }
    blocks.push({ type: "single", item: current, index });
    index += 1;
  }

  return blocks;
}
