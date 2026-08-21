import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLICATION_STATUS } from "../publication-status";
import { resolvePublicIndexability } from "./indexability";
import { inspectNewsArticleStructuredData } from "./json-ld";
import { resolvePublicPublisherIdentity } from "./publisher";
import {
  DISCOVER_FINDING_CLASS,
  DISCOVER_FINDING_CODE,
  DISCOVER_READINESS,
  evaluateDiscoverReadiness,
  parseDiscoverReadinessFilter,
} from "./discover";

const SITE = "https://www.example.com";
const published = resolvePublicIndexability({
  publicationStatus: PUBLICATION_STATUS.PUBLISHED,
  publishedVersionId: "11111111-1111-4111-8111-111111111111",
  publishedAt: new Date("2026-03-01T10:00:00.000Z"),
  deletedAt: null,
  retractedAt: null,
  takedownAt: null,
});

const structured = inspectNewsArticleStructuredData({
  suppressed: false,
  headline: "Yayınlanan haber",
  canonicalUrl: `${SITE}/haber`,
  datePublished: "2026-03-01T10:00:00.000Z",
  dateModified: "2026-03-02T11:30:00.000Z",
  description: "Özet metni yeterince uzun bir açıklama olarak duruyor.",
  authors: ["Ayşe Yazar"],
  imageUrl: "https://media.example.com/hero.jpg",
  articleSection: "Gündem",
  publisherName: "Dergi",
});

function readyInput() {
  return {
    trustedSiteUrl: SITE,
    indexability: published,
    publicTitle: "Yayınlanan haber",
    publicDescription: "Özet metni yeterince uzun bir açıklama olarak duruyor.",
    canonical: { url: `${SITE}/haber` },
    publishedAt: new Date("2026-03-01T10:00:00.000Z"),
    authors: ["Ayşe Yazar"],
    hero: {
      assigned: true,
      publicUrl: "https://media.example.com/hero.jpg",
      altText: "Kapak",
      width: 1600,
      height: 900,
    },
    structuredData: structured,
    publisher: resolvePublicPublisherIdentity({ name: "Dergi" }),
  };
}

describe("Discover readiness", () => {
  it("is READY when technical requirements and recommendations are met, even with external unknowns", () => {
    const evaluation = evaluateDiscoverReadiness(readyInput());
    assert.equal(evaluation.state, DISCOVER_READINESS.READY);
    assert.equal(evaluation.largeImagePreviewAvailable, true);
    assert.equal(
      evaluation.findings.every(
        (finding) => finding.classification === DISCOVER_FINDING_CLASS.EXTERNAL_UNKNOWN,
      ),
      true,
    );
    assert.equal(
      evaluation.findings.some(
        (finding) => finding.code === DISCOVER_FINDING_CODE.DISCOVER_PLACEMENT_UNKNOWN,
      ),
      true,
    );
  });

  it("marks withdrawn and noindex articles NOT_ELIGIBLE without treating unknown crawl status as the cause", () => {
    const withdrawn = evaluateDiscoverReadiness({
      ...readyInput(),
      indexability: resolvePublicIndexability({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: "11111111-1111-4111-8111-111111111111",
        publishedAt: new Date("2026-03-01T10:00:00.000Z"),
        deletedAt: null,
        retractedAt: new Date("2026-03-05T12:00:00.000Z"),
        takedownAt: null,
      }),
    });
    assert.equal(withdrawn.state, DISCOVER_READINESS.NOT_ELIGIBLE);
    assert.equal(
      withdrawn.findings.some(
        (finding) => finding.code === DISCOVER_FINDING_CODE.LEGALLY_WITHDRAWN,
      ),
      true,
    );

    const noindex = evaluateDiscoverReadiness({
      ...readyInput(),
      indexability: resolvePublicIndexability({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: "11111111-1111-4111-8111-111111111111",
        publishedAt: new Date("2026-03-01T10:00:00.000Z"),
        deletedAt: null,
        retractedAt: null,
        takedownAt: null,
        storedRobots: "noindex",
      }),
    });
    assert.equal(noindex.state, DISCOVER_READINESS.NOT_ELIGIBLE);
    assert.equal(noindex.largeImagePreviewAvailable, false);
  });

  it("keeps a small source HERO as NEEDS_ATTENTION without assuming upscaling", () => {
    const evaluation = evaluateDiscoverReadiness({
      ...readyInput(),
      hero: {
        assigned: true,
        publicUrl: "https://media.example.com/hero.jpg",
        altText: "Kapak",
        width: 800,
        height: 600,
      },
    });
    assert.equal(evaluation.state, DISCOVER_READINESS.NEEDS_ATTENTION);
    const small = evaluation.findings.find(
      (finding) => finding.code === DISCOVER_FINDING_CODE.HERO_TOO_SMALL,
    );
    assert.equal(small?.message, "Kaynak görsel yeterince büyük değil.");
    assert.equal(small?.classification, DISCOVER_FINDING_CLASS.RECOMMENDATION);
  });

  it("treats missing publisher and HTTP origin as recommendation vs technical independently", () => {
    const missingPublisher = evaluateDiscoverReadiness({
      ...readyInput(),
      publisher: null,
      structuredData: inspectNewsArticleStructuredData({
        suppressed: false,
        headline: "Yayınlanan haber",
        canonicalUrl: `${SITE}/haber`,
        datePublished: "2026-03-01T10:00:00.000Z",
        dateModified: "2026-03-02T11:30:00.000Z",
        description: "Özet metni yeterince uzun bir açıklama olarak duruyor.",
        authors: ["Ayşe Yazar"],
        imageUrl: "https://media.example.com/hero.jpg",
        articleSection: "Gündem",
        publisherName: null,
      }),
    });
    assert.equal(missingPublisher.state, DISCOVER_READINESS.NEEDS_ATTENTION);

    const httpOrigin = evaluateDiscoverReadiness({
      ...readyInput(),
      trustedSiteUrl: "http://www.example.com",
    });
    assert.equal(httpOrigin.state, DISCOVER_READINESS.NOT_ELIGIBLE);
    assert.equal(
      httpOrigin.findings.some(
        (finding) => finding.code === DISCOVER_FINDING_CODE.PUBLIC_ORIGIN_NOT_HTTPS,
      ),
      true,
    );
  });

  it("parses Discover filter tokens without inventing values", () => {
    assert.equal(parseDiscoverReadinessFilter(undefined), undefined);
    assert.equal(parseDiscoverReadinessFilter("READY"), DISCOVER_READINESS.READY);
    assert.equal(parseDiscoverReadinessFilter("MAYBE"), null);
  });
});
