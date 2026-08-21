import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MEDIA_PUBLIC_INELIGIBILITY_REASON, MEDIA_RIGHTS_STATUS } from "../media-rights";
import { PUBLICATION_STATUS } from "../publication-status";
import {
  SEO_FINDING_CODE,
  evaluateSeoHealth,
  inspectHeroRenditionSuitability,
  type SeoHealthEvaluationInput,
} from "./health";
import { SEO_FINDING_KIND, SEO_FINDING_SEVERITY, SEO_SCORE_POLICY } from "./policy";

function healthyInput(
  overrides: Partial<SeoHealthEvaluationInput> = {},
): SeoHealthEvaluationInput {
  return {
    trustedSiteUrl: "https://www.example.com",
    editorOrigin: "https://editor.example.com",
    slug: "kanonik-haber",
    title: "Yayınlanan magazin haberi",
    seoTitle: null,
    seoDescription: null,
    excerpt:
      "Bu özet metni elliden uzun karakterle kamu meta açıklamasını doldurur.",
    subtitle: "Deck",
    storedCanonicalUrl: null,
    storedRobots: null,
    publicationStatus: PUBLICATION_STATUS.PUBLISHED,
    publishedVersionId: "11111111-1111-4111-8111-111111111111",
    publishedAt: new Date("2026-03-01T10:00:00.000Z"),
    publicDateModified: new Date("2026-03-02T11:30:00.000Z"),
    deletedAt: null,
    retractedAt: null,
    takedownAt: null,
    primaryCategoryName: "Gündem",
    authors: ["Ayşe Yazar"],
    hero: {
      assigned: true,
      publicUrl: "https://media.example.com/hero.jpg",
      altText: "Sahne fotoğrafı",
      width: 1600,
      height: 900,
      preferredRenditionAvailable: true,
      usedLegacyOriginalFallback: false,
      rightsEligible: true,
      rightsStatus: MEDIA_RIGHTS_STATUS.CLEARED,
      rightsReasons: [],
    },
    body: {
      blocks: [
        { type: "heading", text: "Giriş" },
        { type: "paragraph", text: "Haber gövdesi burada." },
      ],
    },
    publisherName: "Magazin",
    ...overrides,
  };
}

describe("SEO health model", () => {
  it("returns structured findings and a non-zero score for a healthy published article", () => {
    const result = evaluateSeoHealth(healthyInput());
    assert.equal(result.hasErrors, false);
    assert.equal(result.errorCount, 0);
    assert.equal(result.indexability.indexable, true);
    assert.equal(result.score, SEO_SCORE_POLICY.MAX);
    assert.equal(result.publicCanonicalUrl, "https://www.example.com/kanonik-haber");
    assert.equal(result.publicTitle, "Yayınlanan magazin haberi");
    assert.equal(
      result.findings.every((item) => item.severity !== SEO_FINDING_SEVERITY.ERROR),
      true,
    );
  });

  it("keeps findings authoritative and forces score 0 when an ERROR exists", () => {
    const result = evaluateSeoHealth(healthyInput({ title: "   " }));
    assert.equal(result.hasErrors, true);
    assert.equal(result.score, 0);
    assert.equal(result.findings.some((item) => item.code === SEO_FINDING_CODE.TITLE_MISSING), true);
    assert.equal(
      result.findings.some((item) => item.kind === SEO_FINDING_KIND.TECHNICAL),
      true,
    );
  });

  it("does not treat editorial warnings as technical publish blockers", () => {
    const result = evaluateSeoHealth(
      healthyInput({
        excerpt: null,
        subtitle: null,
        hero: null,
      }),
    );
    assert.equal(result.hasErrors, false);
    assert.equal(result.warningCount > 0, true);
    assert.equal(
      result.findings.some((item) => item.code === SEO_FINDING_CODE.HERO_MISSING),
      true,
    );
    assert.equal(
      result.findings.some((item) => item.code === SEO_FINDING_CODE.META_DESCRIPTION_MISSING),
      true,
    );
    assert.equal(result.score < SEO_SCORE_POLICY.MAX, true);
    assert.equal(result.score > 0, true);
  });

  it("flags missing HERO alt, legacy rendition fallback, and informational rights", () => {
    const fallback = inspectHeroRenditionSuitability({
      originalUrl: "https://media.example.com/original.jpg",
      selectedUrl: "https://media.example.com/original.jpg",
      renditionVariants: [],
    });
    assert.equal(fallback.preferredRenditionAvailable, false);
    assert.equal(fallback.usedLegacyOriginalFallback, true);

    const result = evaluateSeoHealth(
      healthyInput({
        hero: {
          assigned: true,
          publicUrl: "https://media.example.com/original.jpg",
          altText: "  ",
          width: 400,
          height: 300,
          preferredRenditionAvailable: false,
          usedLegacyOriginalFallback: true,
          rightsEligible: false,
          rightsStatus: MEDIA_RIGHTS_STATUS.INCOMPLETE,
          rightsReasons: [MEDIA_PUBLIC_INELIGIBILITY_REASON.RIGHTS_INCOMPLETE],
        },
      }),
    );
    const codes = result.findings.map((item) => item.code);
    assert.equal(codes.includes(SEO_FINDING_CODE.HERO_ALT_MISSING), true);
    assert.equal(codes.includes(SEO_FINDING_CODE.HERO_LEGACY_RENDITION_FALLBACK), true);
    assert.equal(codes.includes(SEO_FINDING_CODE.HERO_RIGHTS_INFORMATIONAL), true);
    assert.equal(result.hasErrors, false);
  });

  it("reports draft/unpublished as not indexable without turning that into an ERROR", () => {
    const draft = evaluateSeoHealth(
      healthyInput({
        publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
        publishedVersionId: null,
        publishedAt: null,
      }),
    );
    assert.equal(draft.indexability.indexable, false);
    assert.equal(draft.hasErrors, false);
    assert.equal(
      draft.findings.some((item) => item.code === SEO_FINDING_CODE.NOT_INDEXABLE),
      true,
    );

    const unpublished = evaluateSeoHealth(
      healthyInput({
        publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
      }),
    );
    assert.equal(unpublished.indexability.indexable, false);
    assert.equal(unpublished.hasErrors, false);
  });

  it("keeps correction-capable published articles indexable and noindexes retraction/takedown", () => {
    const live = evaluateSeoHealth(healthyInput());
    assert.equal(live.indexability.indexable, true);

    const retracted = evaluateSeoHealth(
      healthyInput({
        retractedAt: new Date("2026-03-05T12:00:00.000Z"),
      }),
    );
    assert.equal(retracted.indexability.indexable, false);
    assert.equal(
      retracted.findings.some((item) => item.code === SEO_FINDING_CODE.LEGAL_WITHDRAWAL_NOINDEX),
      true,
    );
    assert.equal(retracted.structuredData.wouldEmit, false);

    const takedown = evaluateSeoHealth(
      healthyInput({
        takedownAt: new Date("2026-03-06T12:00:00.000Z"),
      }),
    );
    assert.equal(takedown.indexability.indexable, false);
    assert.equal(takedown.structuredData.wouldEmit, false);
  });

  it("uses seoTitle and seoDescription as the public metadata contract", () => {
    const used = evaluateSeoHealth(
      healthyInput({
        seoTitle: "Kanonik SEO başlığı",
        seoDescription:
          "Bu SEO açıklaması elliden uzun karakterle kamu meta açıklamasını doldurur.",
      }),
    );
    assert.equal(used.publicTitle, "Kanonik SEO başlığı");
    assert.equal(
      used.publicDescription,
      "Bu SEO açıklaması elliden uzun karakterle kamu meta açıklamasını doldurur.",
    );
    assert.equal(
      used.findings.some((item) => item.code === SEO_FINDING_CODE.SEO_TITLE_MISSING),
      false,
    );

    const fallback = evaluateSeoHealth(healthyInput({ seoTitle: "  ", seoDescription: "  " }));
    assert.equal(fallback.publicTitle, "Yayınlanan magazin haberi");
    assert.equal(
      fallback.publicDescription?.startsWith("Bu özet metni"),
      true,
    );
    assert.equal(
      fallback.findings.some((item) => item.code === SEO_FINDING_CODE.SEO_TITLE_MISSING),
      true,
    );
  });

  it("applies a valid same-origin canonical override and rejects an invalid one", () => {
    const applied = evaluateSeoHealth(
      healthyInput({
        storedCanonicalUrl: "https://www.example.com/ozel-kanonik",
      }),
    );
    assert.equal(applied.publicCanonicalUrl, "https://www.example.com/ozel-kanonik");
    assert.equal(
      applied.findings.some((item) => item.code === SEO_FINDING_CODE.CANONICAL_OVERRIDE_APPLIED),
      true,
    );

    const rejected = evaluateSeoHealth(
      healthyInput({
        storedCanonicalUrl: "https://evil.example/haber",
      }),
    );
    assert.equal(rejected.publicCanonicalUrl, "https://www.example.com/kanonik-haber");
    assert.equal(
      rejected.findings.some((item) => item.code === SEO_FINDING_CODE.CANONICAL_UNTRUSTED_ORIGIN),
      true,
    );
    assert.equal(
      rejected.findings.some((item) => item.code === SEO_FINDING_CODE.CANONICAL_OVERRIDE_APPLIED),
      false,
    );
  });

  it("records a robots noindex restriction without letting it override legal noindex", () => {
    const restricted = evaluateSeoHealth(healthyInput({ storedRobots: "noindex" }));
    assert.equal(restricted.indexability.indexable, false);
    assert.equal(
      restricted.findings.some((item) => item.code === SEO_FINDING_CODE.ROBOTS_NOINDEX_OVERRIDE),
      true,
    );

    const withdrawn = evaluateSeoHealth(
      healthyInput({
        retractedAt: new Date("2026-03-05T12:00:00.000Z"),
        storedRobots: "index,follow",
      }),
    );
    assert.equal(withdrawn.indexability.indexable, false);
    assert.equal(
      withdrawn.findings.some((item) => item.code === SEO_FINDING_CODE.ROBOTS_NOINDEX_OVERRIDE),
      false,
    );
    assert.equal(
      withdrawn.findings.some((item) => item.code === SEO_FINDING_CODE.LEGAL_WITHDRAWAL_NOINDEX),
      true,
    );
  });

  it("treats empty published body as a technical ERROR and missing headings as editorial", () => {
    const empty = evaluateSeoHealth(healthyInput({ body: { blocks: [] } }));
    assert.equal(
      empty.findings.some((item) => item.code === SEO_FINDING_CODE.BODY_EMPTY && item.severity === SEO_FINDING_SEVERITY.ERROR),
      true,
    );

    const noHeading = evaluateSeoHealth(
      healthyInput({
        body: { blocks: [{ type: "paragraph", text: "Sadece paragraf." }] },
      }),
    );
    assert.equal(
      noHeading.findings.some((item) => item.code === SEO_FINDING_CODE.HEADING_MISSING),
      true,
    );
    assert.equal(noHeading.hasErrors, false);
  });
});
