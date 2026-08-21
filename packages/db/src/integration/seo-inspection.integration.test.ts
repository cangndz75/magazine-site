import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  CONTENT_LEGAL_ACTION_TYPE,
  CONTENT_LEGAL_REASON_CATEGORY,
  PUBLICATION_STATUS,
  SEO_FINDING_CODE,
  SEO_FINDING_FILTER,
  SEO_INSPECTION_ERROR,
  STAFF_ROLE,
  STAFF_SCOPE_MODE,
  SeoInspectionError,
  seoInspectionLeaksSensitiveMaterial,
} from "@magazine/domain";
import { getDb } from "../client";
import { mediaRenditions } from "../schema/media";
import {
  approveVersion,
  publishVersion,
  recordContentLegalAction,
  scheduleVersion,
  submitForReview,
  unpublishContent,
  updateDraftScalarFields,
} from "../publishing";
import { listPublicSitemapEntries } from "../seo/sitemap";
import { listSeoInspections } from "../seo/inspection";
import {
  articleBody,
  cleanupFixture,
  closeIntegrationConnections,
  countLeftoverFixtures,
  countOpenTestTransactions,
  createDraftItem,
  createFixture,
  ensureEditorContentTestDatabase,
  type IntegrationFixture,
} from "./harness";

const SITE_URL = "https://www.example.com";
const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";
const SECRET_BODY = "UNPUBLISHED_BODY_SECRET_PHRASE";

describe("SEO inspection and sitemap PostgreSQL foundation", () => {
  let fixture: IntegrationFixture;

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    fixture = await createFixture();
  });

  afterEach(async () => {
    const itemIds = fixture.createdItemIds.slice();
    await cleanupFixture(fixture);
    const leftover = await countLeftoverFixtures(itemIds);
    assert.equal(leftover.items, 0);
    assert.equal(leftover.versions, 0);
    assert.equal(leftover.reviewEvents, 0);
    assert.equal(leftover.auditEvents, 0);
  });

  after(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const leftoverTx = await countOpenTestTransactions();
    assert.equal(leftoverTx, 0, "integration tests leaked open transactions");
    await closeIntegrationConnections();
  });

  async function publishApproved(input: {
    title: string;
    body?: unknown;
    includeRelations?: boolean;
    categories?: { categoryId: string; isPrimary: boolean }[];
    excerpt?: string;
  }) {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: input.includeRelations ?? true,
      title: input.title,
      body: input.body ?? {
        blocks: [
          { type: "heading", text: "Giriş" },
          { type: "paragraph", text: "Yayınlanan haber gövdesi." },
        ],
      },
      categories: input.categories,
    });
    let expectedUpdatedAt = created.updatedAt;
    if (input.excerpt) {
      const updated = await updateDraftScalarFields({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt,
        title: input.title,
        excerpt: input.excerpt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      });
      expectedUpdatedAt = updated.updatedAt;
    }
    const submitted = await submitForReview(
      created.contentItemId,
      created.versionId,
      {
        expectedUpdatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(created.contentItemId, created.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    const published = await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    return { ...created, published };
  }

  it("lists a healthy published article as indexable without leaking storage or legal internals", async () => {
    const published = await publishApproved({
      title: "Yayınlanan magazin haberi",
      excerpt:
        "Bu özet metni elliden uzun karakterle kamu meta açıklamasını doldurur.",
    });
    const listed = await listSeoInspections({
      scope: fixture.superAdmin,
      filters: { limit: 20 },
      trustedSiteUrl: SITE_URL,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const item = listed.items.find(
      (row) => row.contentItemId === published.contentItemId,
    );
    assert.ok(item);
    assert.equal(item.indexability.indexable, true);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(seoInspectionLeaksSensitiveMaterial(item), false);
    const serialized = JSON.stringify(item);
    assert.equal(serialized.includes("storageKey"), false);
    assert.equal(serialized.includes(`itest/${fixture.ids.media}`), false);
    assert.equal(serialized.includes("internalNote"), false);
    assert.equal(serialized.includes("licenseNote"), false);
    assert.equal(serialized.includes('"body"'), false);
    assert.equal(listed.governance.slugRedirectHistoryImplemented, true);
  });

  it("keeps drafts, scheduled versions, and ordinary unpublished articles out of the sitemap", async () => {
    const draft = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title: "Taslak haber",
      body: articleBody("draft"),
    });
    const scheduled = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title: "Zamanlanmış haber",
      body: articleBody("scheduled"),
    });
    const submitted = await submitForReview(
      scheduled.contentItemId,
      scheduled.versionId,
      {
        expectedUpdatedAt: scheduled.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(scheduled.contentItemId, scheduled.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await scheduleVersion(
      scheduled.contentItemId,
      scheduled.versionId,
      new Date(Date.now() + 60 * 60 * 1000),
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    const live = await publishApproved({ title: "Canlı sitemap haberi" });
    const unpublished = await publishApproved({ title: "Kaldırılacak haber" });
    await unpublishContent(
      unpublished.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const sitemap = await listPublicSitemapEntries({
      trustedSiteUrl: SITE_URL,
      limit: 50,
    });
    const locs = sitemap.entries.map((entry) => entry.loc);
    assert.equal(
      locs.includes(`${SITE_URL}/${live.slug}`),
      true,
    );
    assert.equal(
      locs.includes(`${SITE_URL}/${draft.slug}`),
      false,
    );
    assert.equal(
      locs.includes(`${SITE_URL}/${scheduled.slug}`),
      false,
    );
    assert.equal(
      locs.includes(`${SITE_URL}/${unpublished.slug}`),
      false,
    );
    assert.equal(
      locs.every((loc) => loc.startsWith(SITE_URL)),
      true,
    );
  });

  it("keeps correction and clarification indexable and excludes retraction/takedown from the sitemap", async () => {
    const correction = await publishApproved({ title: "Düzeltme haberi" });
    await recordContentLegalAction({
      contentItemId: correction.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.FACTUAL_ERROR,
      internalNote: "Counsel-only correction detail",
      publicNote: "Tarih düzeltildi.",
      expectedUpdatedAt: correction.published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });

    const clarification = await publishApproved({ title: "Açıklama haberi" });
    await recordContentLegalAction({
      contentItemId: clarification.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.CLARIFICATION,
      internalNote: "Counsel-only clarification detail",
      publicNote: "Bağlam eklendi.",
      expectedUpdatedAt: clarification.published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });

    const retracted = await publishApproved({ title: "Geri çekilen haber" });
    await recordContentLegalAction({
      contentItemId: retracted.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.EDITORIAL_STANDARDS,
      internalNote: "Counsel-only retraction detail",
      publicNote: "Geri çekildi.",
      expectedUpdatedAt: retracted.published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });

    const takedown = await publishApproved({ title: "Kaldırılan haber" });
    await recordContentLegalAction({
      contentItemId: takedown.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
      internalNote: "Counsel-only takedown detail",
      publicNote: "Yayından kaldırıldı.",
      expectedUpdatedAt: takedown.published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });

    const sitemap = await listPublicSitemapEntries({
      trustedSiteUrl: SITE_URL,
      limit: 50,
    });
    const locs = sitemap.entries.map((entry) => entry.loc);
    assert.equal(locs.includes(`${SITE_URL}/${correction.slug}`), true);
    assert.equal(locs.includes(`${SITE_URL}/${clarification.slug}`), true);
    assert.equal(locs.includes(`${SITE_URL}/${retracted.slug}`), false);
    assert.equal(locs.includes(`${SITE_URL}/${takedown.slug}`), false);

    const listed = await listSeoInspections({
      scope: fixture.superAdmin,
      filters: { limit: 50 },
      trustedSiteUrl: SITE_URL,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const retractedRow = listed.items.find(
      (row) => row.contentItemId === retracted.contentItemId,
    );
    const takedownRow = listed.items.find(
      (row) => row.contentItemId === takedown.contentItemId,
    );
    const correctionRow = listed.items.find(
      (row) => row.contentItemId === correction.contentItemId,
    );
    assert.equal(correctionRow?.indexability.indexable, true);
    assert.equal(retractedRow?.indexability.indexable, false);
    assert.equal(takedownRow?.indexability.indexable, false);
    assert.equal(JSON.stringify(listed).includes("Counsel-only"), false);
    assert.equal(JSON.stringify(listed).includes("internalNote"), false);
  });

  it("filters missing HERO/alt and reports legacy rendition fallback", async () => {
    const withoutHero = await publishApproved({
      title: "Herosuz haber",
      includeRelations: false,
    });
    const withHero = await publishApproved({ title: "Herolu haber" });
    await getDb().insert(mediaRenditions).values({
      mediaId: fixture.ids.media,
      variant: "large",
      storageKey: `itest/${fixture.ids.media}/large`,
      width: 1280,
      height: 720,
      byteSize: 2048,
    });

    const missingHero = await listSeoInspections({
      scope: fixture.superAdmin,
      filters: { limit: 20, missingHero: true },
      trustedSiteUrl: SITE_URL,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(
      missingHero.items.some((row) => row.contentItemId === withoutHero.contentItemId),
      true,
    );
    assert.equal(
      missingHero.items.some((row) => row.contentItemId === withHero.contentItemId),
      false,
    );

    const listed = await listSeoInspections({
      scope: fixture.superAdmin,
      filters: { limit: 20, indexable: true },
      trustedSiteUrl: SITE_URL,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const withHeroRow = listed.items.find(
      (row) => row.contentItemId === withHero.contentItemId,
    );
    assert.ok(withHeroRow);
    assert.equal(withHeroRow.missingHero, false);
    assert.equal(
      withHeroRow.findings.some(
        (finding) => finding.code === SEO_FINDING_CODE.HERO_LEGACY_RENDITION_FALLBACK,
      ),
      false,
    );
  });

  it("enforces CONTENT_READ and category scope, and never returns unauthorized rows", async () => {
    const onA = await publishApproved({
      title: "Kategori A haberi",
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
    });
    const onB = await publishApproved({
      title: "Kategori B haberi",
      categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
    });

    await assert.rejects(
      () =>
        listSeoInspections({
          scope: {
            roles: [],
            scopeMode: STAFF_SCOPE_MODE.ALL,
            scopedCategoryIds: [],
          },
          filters: { limit: 20 },
          trustedSiteUrl: SITE_URL,
        }),
      (error: unknown) =>
        error instanceof SeoInspectionError &&
        error.code === SEO_INSPECTION_ERROR.FORBIDDEN,
    );

    const scoped = await listSeoInspections({
      scope: fixture.selectedOnA,
      filters: { limit: 20 },
      trustedSiteUrl: SITE_URL,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(
      scoped.items.some((row) => row.contentItemId === onA.contentItemId),
      true,
    );
    assert.equal(
      scoped.items.some((row) => row.contentItemId === onB.contentItemId),
      false,
    );
    assert.equal(seoInspectionLeaksSensitiveMaterial(scoped), false);
    assert.equal(STAFF_ROLE.EDITOR, fixture.selectedOnA.roles[0]);
  });

  it("does not expose unpublished body text on the inspection DTO", async () => {
    await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title: "Gizli taslak",
      body: articleBody(SECRET_BODY),
    });
    const listed = await listSeoInspections({
      scope: fixture.superAdmin,
      filters: { limit: 20, publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED },
      trustedSiteUrl: SITE_URL,
    });
    const serialized = JSON.stringify(listed);
    assert.equal(serialized.includes(SECRET_BODY), false);
    assert.equal(serialized.includes('"body"'), false);
  });

  it("can list errors-only candidates without scanning from the client", async () => {
    await publishApproved({
      title: "Yayınlanan magazin haberi",
      excerpt: "Bu özet metni elliden uzun karakterle kamu meta açıklamasını doldurur.",
    });
    const empty = await publishApproved({
      title: "Boş gövde",
      body: { blocks: [] },
    });
    const listed = await listSeoInspections({
      scope: fixture.superAdmin,
      filters: { limit: 20, findingFilter: SEO_FINDING_FILTER.ERRORS },
      trustedSiteUrl: SITE_URL,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(
      listed.items.some((row) => row.contentItemId === empty.contentItemId),
      true,
    );
    assert.equal(
      listed.items.every((row) => row.errorCount > 0),
      true,
    );
  });
});
