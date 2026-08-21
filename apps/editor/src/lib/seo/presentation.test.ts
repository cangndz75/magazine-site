import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISCOVER_READINESS,
  PUBLIC_INDEXABILITY_REASON,
  PUBLICATION_STATUS,
  SEO_FINDING_CODE,
  SEO_FINDING_KIND,
  SEO_FINDING_SEVERITY,
  SEO_INSPECTION_ERROR,
  SEO_ROBOTS_DIRECTIVE,
  seoInspectionLeaksSensitiveMaterial,
} from "@magazine/domain";
import {
  legalWithdrawalLabel,
  presentDiscoverReadiness,
  presentIndexability,
  presentSeoFinding,
  seoHealthLabel,
  seoRenderedOutputLeaksSecrets,
} from "./presentation";
import { presentSeoSearchPreview } from "./preview";
import {
  serializeSeoInspectionDetail,
  serializeSeoInspectionListItem,
} from "./serialize";
import type { SeoInspectionDetail, SeoInspectionListItem } from "@magazine/domain";

function listItem(
  overrides: Partial<SeoInspectionListItem> = {},
): SeoInspectionListItem {
  return {
    contentItemId: "1a3ccd0d-594e-41cc-9350-9a6085699090",
    title: "Haber",
    slug: "haber",
    publicationStatus: PUBLICATION_STATUS.PUBLISHED,
      indexability: {
        indexable: true,
        reason: PUBLIC_INDEXABILITY_REASON.INDEXABLE,
        robots: { index: true, follow: true },
      },
    findings: [],
    findingCodes: [],
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    hasErrors: false,
    score: 100,
    lastModified: new Date("2026-08-01T12:00:00.000Z"),
    publishedAt: new Date("2026-08-01T12:00:00.000Z"),
    publicDateModified: new Date("2026-08-01T12:00:00.000Z"),
    primaryCategory: { id: "cat", name: "Ekonomi", slug: "ekonomi" },
    legalWithdrawal: null,
    missingMetaDescription: false,
    missingHero: false,
    missingHeroAlt: false,
    discoverReadiness: DISCOVER_READINESS.READY,
    ...overrides,
  };
}

describe("SEO finding and indexability copy", () => {
  it("explains missing description and HERO alt with an editor action", () => {
    const description = presentSeoFinding({
      code: SEO_FINDING_CODE.META_DESCRIPTION_MISSING,
      severity: SEO_FINDING_SEVERITY.WARNING,
      kind: SEO_FINDING_KIND.EDITORIAL,
      message: "missing",
    });
    assert.equal(description.title, "Meta açıklaması eksik");
    assert.match(description.why, /snippet/i);
    assert.match(description.where, /SEO/);
    assert.equal(description.actionable, true);

    const alt = presentSeoFinding({
      code: SEO_FINDING_CODE.HERO_ALT_MISSING,
      severity: SEO_FINDING_SEVERITY.WARNING,
      kind: SEO_FINDING_KIND.EDITORIAL,
      message: "alt",
    });
    assert.equal(alt.title, "HERO alt metni eksik");
    assert.match(alt.where, /HERO/);
  });

  it("does not offer a fix for legal withdrawal noindex", () => {
    const legal = presentSeoFinding({
      code: SEO_FINDING_CODE.LEGAL_WITHDRAWAL_NOINDEX,
      severity: SEO_FINDING_SEVERITY.ERROR,
      kind: SEO_FINDING_KIND.TECHNICAL,
      message: "legal",
    });
    assert.equal(legal.actionable, false);
    assert.match(legal.why, /noindex/i);
    assert.equal(legalWithdrawalLabel("TAKEDOWN"), "Hukuki kaldırma");
  });

  it("keeps health labels independent of color", () => {
    assert.equal(seoHealthLabel({ errorCount: 1, warningCount: 0 }).label, "Kritik");
    assert.equal(seoHealthLabel({ errorCount: 0, warningCount: 1 }).label, "Uyarı");
    assert.equal(seoHealthLabel({ errorCount: 0, warningCount: 0 }).label, "İyi");
  });
});

describe("SEO preview precedence", () => {
  it("uses seoTitle over visible H1 and does not invent description from body", () => {
    const preview = presentSeoSearchPreview({
      trustedSiteUrl: "https://www.example.com",
      slug: "haber",
      title: "Görünen başlık",
      seoTitle: "SEO başlığı",
      seoDescription: null,
      excerpt: "Spot metin",
      subtitle: "Alt başlık",
      storedCanonicalUrl: null,
      storedRobots: null,
      publicationStatus: PUBLICATION_STATUS.PUBLISHED,
      publishedVersionId: "1a3ccd0d-594e-41cc-9350-9a6085699090",
      publishedAt: "2026-08-01T12:00:00.000Z",
      retractedAt: null,
      takedownAt: null,
    });
    assert.equal(preview.title, "SEO başlığı");
    assert.equal(preview.visibleTitle, "Görünen başlık");
    assert.equal(preview.description, "Spot metin");
    assert.equal(preview.url, "https://www.example.com/haber");
    assert.equal(preview.canonical.appliedOverride, false);
  });

  it("keeps system noindex for withdrawn content even with default robots", () => {
    const preview = presentSeoSearchPreview({
      trustedSiteUrl: "https://www.example.com",
      slug: "haber",
      title: "Haber",
      seoTitle: null,
      seoDescription: "Açıklama",
      excerpt: null,
      subtitle: null,
      storedCanonicalUrl: null,
      storedRobots: null,
      publicationStatus: PUBLICATION_STATUS.PUBLISHED,
      publishedVersionId: "1a3ccd0d-594e-41cc-9350-9a6085699090",
      publishedAt: "2026-08-01T12:00:00.000Z",
      retractedAt: "2026-08-02T12:00:00.000Z",
      takedownAt: null,
    });
    const copy = presentIndexability(preview.indexability);
    assert.equal(preview.indexability.indexable, false);
    assert.equal(copy.canEditorOverride, false);
    assert.match(copy.label, /hukuki|İndekslenemez/i);
  });

  it("presents Discover readiness without a placement percentage", () => {
    const ready = presentDiscoverReadiness(DISCOVER_READINESS.READY);
    assert.equal(ready.label, "Teknik olarak hazır");
    assert.equal(ready.label.includes("%"), false);
    assert.match(ready.detail, /trafik garantisi değildir/);
  });

  it("covers every stable finding code with editor-facing copy", () => {
    for (const code of Object.values(SEO_FINDING_CODE)) {
      const copy = presentSeoFinding({
        code,
        severity: SEO_FINDING_SEVERITY.INFO,
        kind: SEO_FINDING_KIND.EDITORIAL,
        message: code,
      });
      assert.equal(typeof copy.title, "string");
      assert.equal(copy.title.length > 0, true, code);
      assert.equal(typeof copy.why, "string");
      assert.equal(typeof copy.where, "string");
    }
  });
});

describe("SEO DTO security boundary", () => {
  it("omits findings from the list DTO and never includes sensitive keys", () => {
    const dto = serializeSeoInspectionListItem(
      listItem({
        findings: [
          {
            code: SEO_FINDING_CODE.HERO_MISSING,
            severity: SEO_FINDING_SEVERITY.WARNING,
            kind: SEO_FINDING_KIND.EDITORIAL,
            message: "hero",
          },
        ],
        findingCodes: [SEO_FINDING_CODE.HERO_MISSING],
        warningCount: 1,
        score: 92,
      }),
    );
    assert.equal("findings" in dto, false);
    assert.equal(JSON.stringify(dto).includes("storageKey"), false);
    assert.equal(JSON.stringify(dto).includes("internalNote"), false);
    assert.equal(dto.warningCount, 1);
  });

  it("serializes inspector metadata, hero, and read-only slug history", () => {
    const detail: SeoInspectionDetail = {
      ...listItem(),
      articleTitle: "Görünen başlık",
      publicTitle: "SEO başlığı",
      publicDescription: "Açıklama",
      publicCanonicalUrl: "https://www.example.com/haber",
      findings: [],
      canonical: {
        resolvedUrl: "https://www.example.com/haber",
        generatedUrl: "https://www.example.com/haber",
        appliedOverride: false,
        storedValuePresent: false,
        rejection: null,
      },
      robots: {
        directive: SEO_ROBOTS_DIRECTIVE.DEFAULT,
        unrecognized: false,
        systemForcedNoindex: false,
        editorRestrictionActive: false,
      },
      structuredData: {
        wouldEmit: true,
        complete: true,
        presentFields: [],
        missingRequiredFields: [],
        missingRecommendedFields: [],
        publisherConfigured: false,
      },
      hero: {
        assigned: true,
        publicUrl: "https://cdn.example.com/hero.jpg",
        altText: "Kapak",
        width: 1200,
        height: 630,
        preferredRenditionAvailable: true,
        usedLegacyOriginalFallback: false,
        rightsInformational: false,
      },
      slugHistory: [
        {
          oldSlug: "eski-haber",
          oldPath: "/eski-haber",
          destinationSlug: "haber",
          destinationPath: "/haber",
          destinationUrl: "https://www.example.com/haber",
          createdAt: new Date("2026-07-01T12:00:00.000Z"),
          actorDisplayName: "Editör",
        },
      ],
      inspectedVersionIsPublicAuthority: true,
      discover: {
        state: DISCOVER_READINESS.READY,
        largeImagePreviewAvailable: true,
        publisherConfigured: false,
        findings: [],
      },
    };
    const dto = serializeSeoInspectionDetail(detail);
    assert.equal(dto.articleTitle, "Görünen başlık");
    assert.equal(dto.publicTitle, "SEO başlığı");
    assert.equal(dto.hero.publicUrl?.includes("storageKey"), false);
    assert.equal(dto.slugHistory[0]?.oldSlug, "eski-haber");
    assert.equal(JSON.stringify(dto).includes("passwordHash"), false);
    assert.equal(JSON.stringify(dto).includes("tokenHash"), false);
    assert.equal(JSON.stringify(dto).includes("secretCiphertext"), false);
  });

  it("rejects leaking inspector payloads", () => {
    assert.equal(
      seoRenderedOutputLeaksSecrets("const url = item.publicUrl"),
      false,
    );
    assert.equal(
      seoInspectionLeaksSensitiveMaterial({ storageKey: "itest/a.jpg" }),
      true,
    );
    assert.equal(
      seoInspectionLeaksSensitiveMaterial({ internalNote: "counsel" }),
      true,
    );
  });
});

describe("SEO inspection error codes stay bounded", () => {
  it("keeps not-found distinct from forbidden", () => {
    assert.equal(SEO_INSPECTION_ERROR.CONTENT_NOT_FOUND, "CONTENT_NOT_FOUND");
    assert.equal(SEO_INSPECTION_ERROR.FORBIDDEN, "FORBIDDEN");
  });
});
