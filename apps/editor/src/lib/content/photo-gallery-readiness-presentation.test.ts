import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateArticleReadiness,
  READINESS_SECTION,
} from "@magazine/domain";
import { buildArticleReadinessInput } from "@/lib/content/build-article-readiness-input";
import { presentPhotoGalleryReadiness } from "@/lib/content/photo-gallery-readiness-presentation";
import type { ArticleEditorRelations } from "@/lib/content/article-relation-state";

const emptyRelations: ArticleEditorRelations = {
  categories: [],
  authors: [],
  tags: [],
  entities: [],
  media: [],
  videos: [],
};

function baseReadiness(relations: ArticleEditorRelations = emptyRelations) {
  return evaluateArticleReadiness(
    buildArticleReadinessInput({
      trustedSiteUrl: "https://magazine.test",
      editorOrigin: "https://editor.test",
      slug: "test-galeri",
      publicationStatus: "NEVER_PUBLISHED",
      publishedVersionId: null,
      publishedAt: null,
      workflowStatus: "DRAFT",
      legalHoldAt: null,
      retractedAt: null,
      takedownAt: null,
      fields: {
        title: "Test galeri",
        subtitle: null,
        excerpt: "Spot metni",
        seoTitle: null,
        seoDescription: null,
        canonicalUrl: null,
        robots: null,
        credibility: null,
        credibilitySource: null,
        source: null,
        sourceOrganization: null,
        sourceUrl: null,
        syndicated: false,
        isMaterialUpdate: false,
      },
      relations,
      bodyDocument: { blocks: [] },
      bodyInspectable: true,
      fieldValidationOk: true,
      fieldValidationErrors: [],
    }),
  );
}

describe("presentPhotoGalleryReadiness", () => {
  it("removes empty-body blocker and surfaces gallery media blockers", () => {
    const presented = presentPhotoGalleryReadiness(
      baseReadiness(),
      emptyRelations,
    );

    const content = presented.sections.find(
      (section) => section.id === READINESS_SECTION.CONTENT,
    );
    assert.equal(
      content?.issues.some((issue) => issue.code === "BODY_EMPTY"),
      false,
    );

    const media = presented.sections.find(
      (section) => section.id === READINESS_SECTION.MEDIA,
    );
    assert.equal(
      media?.issues.some((issue) => issue.code === "GALLERY_COVER_MISSING"),
      true,
    );
    assert.equal(
      media?.issues.some((issue) => issue.code === "GALLERY_IMAGES_MISSING"),
      true,
    );
  });

  it("flags ineligible gallery media in rights section", () => {
    const relations: ArticleEditorRelations = {
      ...emptyRelations,
      media: [
        {
          id: "hero-1",
          label: "Kapak",
          mediaType: "IMAGE",
          width: 1200,
          height: 800,
          role: "HERO",
          sortOrder: 0,
          caption: null,
          altText: "kapak alt",
          credit: "Foto",
          previewUrl: "https://magazine.test/media/hero.jpg",
          creditLine: "Arşiv",
          eligibility: {
            eligible: false,
            status: "RESTRICTED",
            reasons: ["USAGE_RESTRICTED"],
          },
        },
        {
          id: "gallery-1",
          label: "Galeri 1",
          mediaType: "IMAGE",
          width: 1200,
          height: 800,
          role: "GALLERY",
          sortOrder: 0,
          caption: "İlk kare",
          altText: "alt",
          credit: "Foto",
          previewUrl: "https://magazine.test/media/g1.jpg",
          creditLine: "Arşiv",
          eligibility: {
            eligible: true,
            status: "CLEARED",
            reasons: [],
          },
        },
      ],
    };

    const presented = presentPhotoGalleryReadiness(baseReadiness(relations), relations);
    const rights = presented.sections.find(
      (section) => section.id === READINESS_SECTION.RIGHTS,
    );
    assert.equal(
      rights?.issues.some((issue) => issue.code === "GALLERY_MEDIA_INELIGIBLE"),
      true,
    );
  });
});
