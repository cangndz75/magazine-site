import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  READINESS_OVERALL_STATE,
  READINESS_SECTION,
  READINESS_SECTION_STATE,
  evaluateArticleReadiness,
  type ArticleReadinessInput,
} from "./readiness";

const SITE = "https://magazine.example";

function baseInput(
  overrides: Partial<ArticleReadinessInput> = {},
): ArticleReadinessInput {
  return {
    trustedSiteUrl: SITE,
    editorOrigin: "https://editor.example",
    slug: "ornek-haber",
    publicationStatus: "NEVER_PUBLISHED",
    publishedVersionId: null,
    publishedAt: null,
    workflowStatus: "APPROVED",
    legalHoldAt: null,
    retractedAt: null,
    takedownAt: null,
    title: "Örnek haber başlığı",
    seoTitle: "SEO başlığı",
    seoDescription: "Bu haber için yeterince uzun bir SEO açıklaması var.",
    excerpt: "Spot metni",
    subtitle: null,
    storedCanonicalUrl: null,
    storedRobots: null,
    body: {
      blocks: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Gövde metni burada." }],
        },
      ],
    },
    bodyInspectable: true,
    categories: [{ isPrimary: true, name: "Gündem" }],
    authors: [{ displayName: "Ayşe Yazar" }],
    entities: [],
    hero: {
      assigned: true,
      publicUrl: `${SITE}/media/hero.jpg`,
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
    ...overrides,
  };
}

describe("article readiness", () => {
  it("marks a publish-ready approved article without inventing scores", () => {
    const readiness = evaluateArticleReadiness(
      baseInput({
        publicationStatus: "PUBLISHED",
        publishedVersionId: "11111111-1111-4111-8111-111111111111",
        publishedAt: new Date().toISOString(),
      }),
    );
    assert.equal(readiness.blockingIssues.length, 0);
    assert.equal(readiness.summary.blockingIssueCount, 0);
    assert.ok(readiness.summary.readyCount >= 4);
    assert.equal(
      readiness.sections.some((section) => section.id === READINESS_SECTION.SEO),
      true,
    );
    const publication = readiness.sections.find(
      (section) => section.id === READINESS_SECTION.PUBLICATION,
    );
    const content = readiness.sections.find(
      (section) => section.id === READINESS_SECTION.CONTENT,
    );
    assert.equal(publication?.state, READINESS_SECTION_STATE.READY);
    assert.equal(content?.state, READINESS_SECTION_STATE.READY);
    assert.notEqual(readiness.overallState, READINESS_OVERALL_STATE.BLOCKED);
  });

  it("surfaces warning-only SEO and media gaps without blocking publish", () => {
    const readiness = evaluateArticleReadiness(
      baseInput({
        hero: {
          assigned: false,
          publicUrl: null,
          altText: null,
          width: null,
          height: null,
          preferredRenditionAvailable: false,
          usedLegacyOriginalFallback: false,
          rightsEligible: null,
          rightsStatus: null,
          rightsReasons: [],
        },
        seoDescription: null,
      }),
    );

    assert.equal(readiness.overallState, READINESS_OVERALL_STATE.NEEDS_ATTENTION);
    assert.equal(readiness.blockingIssues.length, 0);
    assert.ok(readiness.warnings.length > 0);
    const media = readiness.sections.find(
      (section) => section.id === READINESS_SECTION.MEDIA,
    );
    assert.equal(media?.state, READINESS_SECTION_STATE.NEEDS_ATTENTION);
  });

  it("blocks publish when primary category or approval requirements fail", () => {
    const readiness = evaluateArticleReadiness(
      baseInput({
        categories: [{ isPrimary: false, name: "Ekonomi" }],
        workflowStatus: "APPROVED",
      }),
    );

    assert.equal(readiness.overallState, READINESS_OVERALL_STATE.BLOCKED);
    assert.ok(readiness.blockingIssues.length > 0);
    const publication = readiness.sections.find(
      (section) => section.id === READINESS_SECTION.PUBLICATION,
    );
    assert.equal(publication?.state, READINESS_SECTION_STATE.BLOCKED);
  });

  it("marks rights section not applicable without hero", () => {
    const readiness = evaluateArticleReadiness(
      baseInput({
        hero: null,
      }),
    );
    const rights = readiness.sections.find(
      (section) => section.id === READINESS_SECTION.RIGHTS,
    );
    assert.equal(rights?.state, READINESS_SECTION_STATE.NOT_APPLICABLE);
  });

  it("warns on archived entity relations and pending link suggestions", () => {
    const readiness = evaluateArticleReadiness(
      baseInput({
        entities: [{ id: "1", status: "ARCHIVED" }],
        pendingLinkSuggestionCount: 2,
        ambiguousLinkSuggestionCount: 1,
      }),
    );
    const entities = readiness.sections.find(
      (section) => section.id === READINESS_SECTION.ENTITIES,
    );
    assert.equal(entities?.state, READINESS_SECTION_STATE.NEEDS_ATTENTION);
    assert.ok(
      entities?.issues.some((item) => item.code === "ENTITY_ARCHIVED"),
    );
  });

  it("blocks legal states prominently", () => {
    const readiness = evaluateArticleReadiness(
      baseInput({
        legalHoldAt: new Date().toISOString(),
      }),
    );
    assert.equal(readiness.overallState, READINESS_OVERALL_STATE.BLOCKED);
    const legal = readiness.sections.find(
      (section) => section.id === READINESS_SECTION.LEGAL,
    );
    assert.equal(legal?.state, READINESS_SECTION_STATE.BLOCKED);
  });
});
