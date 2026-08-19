import type { ArticleEditorHeroAttachment } from "@magazine/db/publishing";

export function serializeDraftHero(hero: ArticleEditorHeroAttachment | null) {
  if (!hero) {
    return null;
  }

  return {
    id: hero.id,
    label: hero.label,
    mediaType: hero.mediaType,
    width: hero.width,
    height: hero.height,
    role: hero.role,
    sortOrder: hero.sortOrder,
    caption: hero.caption,
    altText: hero.altText,
    credit: hero.credit,
    previewUrl: hero.previewUrl,
    creatorName: hero.creatorName,
    creditLine: hero.creditLine,
    eligibility: hero.eligibility,
  };
}
