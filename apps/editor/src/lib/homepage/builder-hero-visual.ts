import type { EditorSafeHeroThumbnail } from "@magazine/domain";

export type HomepageBuilderHeroSize = "pool" | "lead" | "support" | "featured";

export function homepageBuilderHeroVisual(
  hero: EditorSafeHeroThumbnail | null,
  imageFailed: boolean,
): "image" | "placeholder" {
  if (!hero?.url || imageFailed) {
    return "placeholder";
  }
  return "image";
}
