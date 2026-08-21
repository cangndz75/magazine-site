import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  CONTENT_LEGAL_ACTION_TYPE,
  CONTENT_LEGAL_REASON_CATEGORY,
  PUBLISHING_ERROR,
  PublishingError,
  SEO_FINDING_CODE,
} from "@magazine/domain";
import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { getPublicArticleBySlug, getPublicArticlePageBySlug } from "../public";
import {
  approveVersion,
  createDraftRevision,
  publishVersion,
  recordContentLegalAction,
  scheduleVersion,
  submitForReview,
  unpublishContent,
  updateContentSlug,
  updateDraftScalarFields,
} from "../publishing";
import {
  clearPublishingTestHooks,
  setPublishingTestHooks,
} from "../publishing/test-hooks";
import { contentAuditEvents } from "../schema/audit-events";
import { contentItems } from "../schema/content";
import { publicCacheOutbox } from "../schema/outbox";
import { contentSlugHistory } from "../schema/slug-history";
import { countPublicSitemapArticles, listPublicSitemapEntries } from "../seo/sitemap";
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
  uniqueSlug,
  type IntegrationFixture,
} from "./harness";

const SITE_URL = "https://www.example.com";

function assertPublishingCode(error: unknown, code: string): void {
  assert.equal(error instanceof PublishingError, true, String(error));
  assert.equal((error as PublishingError).code, code);
}

describe("content slug history and public metadata authority", () => {
  let fixture: IntegrationFixture;

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    fixture = await createFixture();
  });

  afterEach(async () => {
    clearPublishingTestHooks();
    const itemIds = fixture.createdItemIds.slice();
    await cleanupFixture(fixture);
    const leftover = await countLeftoverFixtures(itemIds);
    assert.equal(leftover.items, 0);
    assert.equal(leftover.versions, 0);
    assert.equal(leftover.auditEvents, 0);
    assert.equal(leftover.slugHistory, 0);
  });

  after(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const leftoverTx = await countOpenTestTransactions();
    assert.equal(leftoverTx, 0, "integration tests leaked open transactions");
    await closeIntegrationConnections();
  });

  async function publishApproved(title: string, slug?: string) {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title,
      body: {
        blocks: [
          { type: "heading", text: "Giriş" },
          { type: "paragraph", text: "Yayınlanan haber gövdesi." },
        ],
      },
    });
    if (slug) {
      const renamed = await updateContentSlug({
        contentItemId: created.contentItemId,
        nextSlug: slug,
        expectedUpdatedAt: created.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      });
      created.slug = renamed.slug;
      created.updatedAt = renamed.updatedAt;
    }
    const submitted = await submitForReview(
      created.contentItemId,
      created.versionId,
      {
        expectedUpdatedAt: created.updatedAt,
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

  it("redirects A and B to current C in one hop and keeps sitemap on C only", async () => {
    const slugA = uniqueSlug("sluga");
    const slugB = uniqueSlug("slugb");
    const slugC = uniqueSlug("slugc");
    const created = await publishApproved("Slug zinciri", slugA);

    const toB = await updateContentSlug({
      contentItemId: created.contentItemId,
      nextSlug: slugB,
      expectedUpdatedAt: created.published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    const toC = await updateContentSlug({
      contentItemId: created.contentItemId,
      nextSlug: slugC,
      expectedUpdatedAt: toB.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });

    const current = await getPublicArticlePageBySlug(slugC);
    assert.equal(current?.status, "live");
    if (current?.status === "live") {
      assert.equal(current.article.slug, slugC);
      assert.equal(current.article.title, "Slug zinciri");
    }

    const fromA = await getPublicArticlePageBySlug(slugA);
    assert.deepEqual(fromA, {
      status: "redirect",
      toSlug: slugC,
      contentItemId: created.contentItemId,
    });
    const fromB = await getPublicArticlePageBySlug(slugB);
    assert.deepEqual(fromB, {
      status: "redirect",
      toSlug: slugC,
      contentItemId: created.contentItemId,
    });

    const sitemap = await listPublicSitemapEntries({
      trustedSiteUrl: SITE_URL,
      limit: 100,
    });
    const locs = sitemap.entries.map((entry) => entry.loc);
    assert.equal(locs.includes(`${SITE_URL}/${slugC}`), true);
    assert.equal(locs.includes(`${SITE_URL}/${slugA}`), false);
    assert.equal(locs.includes(`${SITE_URL}/${slugB}`), false);

    const firstShard = await listPublicSitemapEntries({
      trustedSiteUrl: SITE_URL,
      limit: 1,
      offset: 0,
    });
    assert.equal(firstShard.entries.length <= 1, true);
    const counted = await countPublicSitemapArticles();
    assert.equal(counted >= 1, true);

    const inspections = await listSeoInspections({
      scope: fixture.superAdmin,
      filters: { limit: 20 },
      trustedSiteUrl: SITE_URL,
    });
    const row = inspections.items.find(
      (item) => item.contentItemId === created.contentItemId,
    );
    assert.ok(row);
    assert.equal(
      row.findings.some((finding) => finding.code === SEO_FINDING_CODE.SLUG_REDIRECT_COVERAGE),
      true,
    );

    const db = getDb();
    const outbox = await db
      .select({ payload: publicCacheOutbox.payload })
      .from(publicCacheOutbox);
    const slugs = outbox
      .filter((event) => event.payload.contentItemId === created.contentItemId)
      .map((event) => event.payload.slug);
    assert.equal(slugs.includes(slugA), true);
    assert.equal(slugs.includes(slugB), true);
    assert.equal(slugs.includes(slugC), true);

    const audit = await db
      .select({
        eventType: contentAuditEvents.eventType,
        changeSet: contentAuditEvents.changeSet,
      })
      .from(contentAuditEvents)
      .where(eq(contentAuditEvents.contentItemId, created.contentItemId));
    const slugEvents = audit.filter(
      (event) => event.eventType === CONTENT_AUDIT_EVENT_TYPE.CONTENT_SLUG_CHANGED,
    );
    assert.equal(slugEvents.length, 3);
    assert.equal(
      slugEvents.some(
        (event) =>
          event.changeSet?.slugChange?.before === slugB &&
          event.changeSet?.slugChange?.after === slugC,
      ),
      true,
    );
    assert.equal(toC.unchanged, false);
  });

  it("rejects collisions, stale tokens, and out-of-scope editors without deleting foreign history", async () => {
    const first = await publishApproved("Birinci");
    const second = await publishApproved("İkinci");
    await updateContentSlug({
      contentItemId: first.contentItemId,
      nextSlug: uniqueSlug("first-new"),
      expectedUpdatedAt: first.published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });

    const [firstHistory] = await getDb()
      .select()
      .from(contentSlugHistory)
      .where(eq(contentSlugHistory.contentItemId, first.contentItemId))
      .limit(1);
    assert.ok(firstHistory);

    await assert.rejects(
      () =>
        updateContentSlug({
          contentItemId: second.contentItemId,
          nextSlug: first.slug,
          expectedUpdatedAt: second.published.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
        }),
      (error) => {
        assertPublishingCode(error, PUBLISHING_ERROR.SLUG_CONFLICT);
        return true;
      },
    );

    const [secondItem] = await getDb()
      .select({ slug: contentItems.slug })
      .from(contentItems)
      .where(eq(contentItems.id, second.contentItemId))
      .limit(1);
    assert.equal(secondItem?.slug, second.slug);

    const stillHistory = await getDb()
      .select({ id: contentSlugHistory.id })
      .from(contentSlugHistory)
      .where(eq(contentSlugHistory.id, firstHistory.id))
      .limit(1);
    assert.equal(stillHistory.length, 1);

    await assert.rejects(
      () =>
        updateContentSlug({
          contentItemId: second.contentItemId,
          nextSlug: uniqueSlug("stale"),
          expectedUpdatedAt: new Date("2020-01-01T00:00:00.000Z"),
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
        }),
      (error) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
        return true;
      },
    );

    await assert.rejects(
      () =>
        updateContentSlug({
          contentItemId: second.contentItemId,
          nextSlug: uniqueSlug("scope"),
          expectedUpdatedAt: second.published.updatedAt,
          scope: fixture.selectedOnB,
          actorId: fixture.ids.staffEditor,
        }),
      (error) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      },
    );
  });

  it("rolls back slug and history together when the transaction fails after the write", async () => {
    const created = await publishApproved("Atomik slug");
    const nextSlug = uniqueSlug("atomic-next");
    setPublishingTestHooks({
      beforeAuditEventInserted: async () => {
        throw new Error("forced slug mutation failure");
      },
    });

    await assert.rejects(
      () =>
        updateContentSlug({
          contentItemId: created.contentItemId,
          nextSlug,
          expectedUpdatedAt: created.published.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
        }),
      /forced slug mutation failure/,
    );

    const [item] = await getDb()
      .select({ slug: contentItems.slug })
      .from(contentItems)
      .where(eq(contentItems.id, created.contentItemId))
      .limit(1);
    assert.equal(item?.slug, created.slug);
    const history = await getDb()
      .select({ id: contentSlugHistory.id })
      .from(contentSlugHistory)
      .where(eq(contentSlugHistory.contentItemId, created.contentItemId));
    assert.equal(history.length, 0);
    assert.equal(await getPublicArticlePageBySlug(created.slug) !== null, true);
    assert.equal(await getPublicArticlePageBySlug(nextSlug), null);
  });

  it("does not leak draft SEO fields and does not expose unpublished or scheduled-only old slugs", async () => {
    const created = await publishApproved("Yayınlanan başlık");
    const revision = await createDraftRevision(
      created.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    await updateDraftScalarFields({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      title: "Yayınlanan başlık",
      seoTitle: "Taslak SEO başlığı",
      seoDescription: "Taslak SEO açıklaması sızmamalı",
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });

    const live = await getPublicArticleBySlug(created.slug);
    assert.equal(live?.title, "Yayınlanan başlık");
    assert.equal(live?.seoTitle, null);
    assert.equal(live?.seoDescription, null);

    const unpublished = await publishApproved("Kaldırılacak");
    const unpublishedRenamed = await updateContentSlug({
      contentItemId: unpublished.contentItemId,
      nextSlug: uniqueSlug("unpub-new"),
      expectedUpdatedAt: unpublished.published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    await unpublishContent(
      unpublished.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    assert.equal(await getPublicArticlePageBySlug(unpublished.slug), null);
    assert.equal(await getPublicArticlePageBySlug(unpublishedRenamed.slug), null);

    const scheduled = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title: "Zamanlanmış",
      body: articleBody("scheduled"),
    });
    const scheduledSlug = scheduled.slug;
    const scheduledRenamed = await updateContentSlug({
      contentItemId: scheduled.contentItemId,
      nextSlug: uniqueSlug("sched-new"),
      expectedUpdatedAt: scheduled.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    const submitted = await submitForReview(
      scheduled.contentItemId,
      scheduled.versionId,
      {
        expectedUpdatedAt: scheduledRenamed.updatedAt,
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
    assert.equal(await getPublicArticlePageBySlug(scheduledSlug), null);
    assert.equal(await getPublicArticlePageBySlug(scheduledRenamed.slug), null);
  });

  it("redirects a retracted old slug to the withdrawn shell and keeps robots override out of the sitemap", async () => {
    const created = await publishApproved("Geri çekilecek");
    const renamed = await updateContentSlug({
      contentItemId: created.contentItemId,
      nextSlug: uniqueSlug("retract-new"),
      expectedUpdatedAt: created.published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.EDITORIAL_STANDARDS,
      internalNote: "Counsel-only retraction detail",
      publicNote: "Geri çekildi.",
      expectedUpdatedAt: renamed.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });

    const old = await getPublicArticlePageBySlug(created.slug);
    assert.deepEqual(old, {
      status: "redirect",
      toSlug: renamed.slug,
      contentItemId: created.contentItemId,
    });
    const current = await getPublicArticlePageBySlug(renamed.slug);
    assert.equal(current?.status, "withdrawn");
    assert.equal(await getPublicArticleBySlug(created.slug), null);

    const robotsArticle = await publishApproved("Noindex sitemap");
    const withRobots = await createDraftRevision(
      robotsArticle.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    const robotsDraft = await updateDraftScalarFields({
      contentItemId: robotsArticle.contentItemId,
      versionId: withRobots.versionId,
      expectedUpdatedAt: withRobots.updatedAt,
      title: "Noindex sitemap",
      robots: "noindex",
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    const submitted = await submitForReview(
      robotsArticle.contentItemId,
      withRobots.versionId,
      {
        expectedUpdatedAt: robotsDraft.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(robotsArticle.contentItemId, withRobots.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await publishVersion(
      robotsArticle.contentItemId,
      withRobots.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const sitemap = await listPublicSitemapEntries({
      trustedSiteUrl: SITE_URL,
      limit: 100,
    });
    const locs = sitemap.entries.map((entry) => entry.loc);
    assert.equal(locs.includes(`${SITE_URL}/${robotsArticle.slug}`), false);
    assert.equal(locs.includes(`${SITE_URL}/${created.slug}`), false);
    assert.equal(locs.includes(`${SITE_URL}/${renamed.slug}`), false);
  });

  it("allows reclaiming a historical slug of the same item without creating a redirect loop", async () => {
    const slugA = uniqueSlug("loop-a");
    const slugB = uniqueSlug("loop-b");
    const created = await publishApproved("Döngü yok", slugA);
    const toB = await updateContentSlug({
      contentItemId: created.contentItemId,
      nextSlug: slugB,
      expectedUpdatedAt: created.published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    await updateContentSlug({
      contentItemId: created.contentItemId,
      nextSlug: slugA,
      expectedUpdatedAt: toB.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });

    const current = await getPublicArticlePageBySlug(slugA);
    assert.equal(current?.status, "live");
    const oldB = await getPublicArticlePageBySlug(slugB);
    assert.deepEqual(oldB, {
      status: "redirect",
      toSlug: slugA,
      contentItemId: created.contentItemId,
    });
  });
});
