"use client";

import { ArticleHeroSection } from "@/components/article-hero-section";
import type { ArticleEditorMedia } from "@/lib/content/article-relation-state";

type PhotoGalleryCoverSectionProps = {
  hero: ArticleEditorMedia | null;
  disabled: boolean;
  busy: boolean;
  onSelect: (next: ArticleEditorMedia) => void;
  onRemove: () => void;
  onPresentationChange: (patch: {
    altText: string | null;
    credit: string | null;
  }) => void;
};

export function PhotoGalleryCoverSection({
  hero,
  disabled,
  busy,
  onSelect,
  onRemove,
  onPresentationChange,
}: PhotoGalleryCoverSectionProps) {
  return (
    <section
      id="editor-section-cover"
      className="scroll-mt-28 rounded border border-zinc-200 bg-white p-4 sm:p-5"
    >
      <ArticleHeroSection
        hero={hero}
        disabled={disabled}
        busy={busy}
        context="gallery"
        onSelect={onSelect}
        onRemove={onRemove}
        onPresentationChange={onPresentationChange}
      />
    </section>
  );
}
