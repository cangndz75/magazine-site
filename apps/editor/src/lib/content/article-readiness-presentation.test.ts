import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  presentReadinessSummary,
  presentSaveState,
  presentSaveStateLabel,
} from "./article-readiness-presentation";
import {
  READINESS_OVERALL_STATE,
  READINESS_SECTION,
  READINESS_SECTION_STATE,
  evaluateArticleReadiness,
} from "@magazine/domain";

describe("article readiness presentation", () => {
  it("summarizes ready state without percentages", () => {
    const readiness = evaluateArticleReadiness({
      trustedSiteUrl: "https://magazine.example",
      slug: "ornek",
      publicationStatus: "PUBLISHED",
      publishedVersionId: "11111111-1111-4111-8111-111111111111",
      publishedAt: new Date().toISOString(),
      workflowStatus: "APPROVED",
      legalHoldAt: null,
      retractedAt: null,
      takedownAt: null,
      title: "Başlık",
      seoTitle: "SEO",
      seoDescription: "Uzun bir SEO açıklaması burada yer alıyor.",
      excerpt: "Spot",
      subtitle: null,
      storedCanonicalUrl: null,
      storedRobots: null,
      body: {
        blocks: [{ type: "paragraph", content: [{ type: "text", text: "Metin" }] }],
      },
      bodyInspectable: true,
      categories: [{ isPrimary: true, name: "Gündem" }],
      authors: [{ displayName: "Yazar" }],
      entities: [],
      hero: {
        assigned: true,
        publicUrl: "https://magazine.example/media/hero.jpg",
        altText: "Kapak",
        width: 1600,
        height: 900,
        preferredRenditionAvailable: true,
        usedLegacyOriginalFallback: false,
        rightsEligible: true,
        rightsStatus: "ELIGIBLE",
        rightsReasons: [],
      },
      fieldValidationOk: true,
      fieldValidationErrors: [],
    });

    assert.equal(readiness.summary.blockingIssueCount, 0);
    assert.doesNotMatch(presentReadinessSummary(readiness), /%/);
    assert.notEqual(readiness.overallState, READINESS_OVERALL_STATE.BLOCKED);
    const publication = readiness.sections.find(
      (section) => section.id === READINESS_SECTION.PUBLICATION,
    );
    assert.equal(publication?.state, READINESS_SECTION_STATE.READY);
  });

  it("summarizes blocked publish state", () => {
    const readiness = evaluateArticleReadiness({
      trustedSiteUrl: "https://magazine.example",
      slug: "ornek",
      publicationStatus: "NEVER_PUBLISHED",
      publishedVersionId: null,
      publishedAt: null,
      workflowStatus: "APPROVED",
      legalHoldAt: new Date().toISOString(),
      retractedAt: null,
      takedownAt: null,
      title: "Başlık",
      seoTitle: null,
      seoDescription: null,
      excerpt: null,
      subtitle: null,
      storedCanonicalUrl: null,
      storedRobots: null,
      body: {
        blocks: [{ type: "paragraph", content: [{ type: "text", text: "Metin" }] }],
      },
      bodyInspectable: true,
      categories: [{ isPrimary: true, name: "Gündem" }],
      authors: [{ displayName: "Yazar" }],
      entities: [],
      hero: null,
      fieldValidationOk: true,
      fieldValidationErrors: [],
    });

    assert.match(presentReadinessSummary(readiness), /yayın engeli var/);
  });
});

describe("save state presentation", () => {
  it("maps clean, dirty, saving, error, and conflict states", () => {
    assert.equal(
      presentSaveStateLabel(presentSaveState({ isDirty: false, isSaving: false, saveKind: "idle" })),
      "Kaydedildi",
    );
    assert.equal(
      presentSaveStateLabel(presentSaveState({ isDirty: true, isSaving: false, saveKind: "idle" })),
      "Kaydedilmemiş değişiklikler",
    );
    assert.equal(
      presentSaveStateLabel(presentSaveState({ isDirty: true, isSaving: true, saveKind: "idle" })),
      "Kaydediliyor",
    );
    assert.equal(
      presentSaveState({
        isDirty: true,
        isSaving: false,
        saveKind: "conflict",
      }).kind,
      "conflict",
    );
  });
});
