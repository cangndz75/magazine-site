import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  AUTHOR_ROLE,
  MEDIA_ROLE,
  MEDIA_TYPE,
  PUBLICATION_STATUS,
  SCHEDULED_PUBLISH_DECISION,
  WORKFLOW_STATUS,
} from "@magazine/domain";
import { eq } from "drizzle-orm";
import { getDb } from "../client";
import { getPublicArticleBySlug } from "../public";
import {
  approveVersion,
  createDraftRevision,
  executeScheduledPublish,
  getContentItem,
  publishVersion,
  scheduleVersion,
  setDraftVersionGallery,
  submitForReview,
  unpublishContent,
  updateDraftContent,
} from "../publishing";
import {
  articleBody,
  cleanupFixture,
  closeIntegrationConnections,
  countLeftoverFixtures,
  countOpenTestTransactions,
  createDraftItem,
  createFixture,
  ensureEditorContentTestDatabase,
  snapshotContent,
  type IntegrationFixture,
} from "./harness";
import { media } from "../schema";

const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";

describe("public article read PostgreSQL", () => {
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
    body: unknown;
    includeRelations?: boolean;
  }) {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: input.includeRelations ?? true,
      title: input.title,
      body: input.body,
    });
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

  function assertNoInternalLeak(article: object): void {
    const serialized = JSON.stringify(article);
    assert.equal(serialized.includes("workflowStatus"), false);
    assert.equal(serialized.includes("draftVersionId"), false);
    assert.equal(serialized.includes("scheduledVersionId"), false);
    assert.equal(serialized.includes("scheduleGeneration"), false);
    assert.equal(serialized.includes("publicationStatus"), false);
    assert.equal(serialized.includes("legalHold"), false);
    assert.equal(serialized.includes("internalNote"), false);
    assert.equal(serialized.includes("reasonCategory"), false);
    assert.equal(serialized.includes("actorStaffUserId"), false);
    assert.equal(serialized.includes("storageKey"), false);
    assert.equal(serialized.includes("mimeType"), false);
    assert.equal(serialized.includes("byteSize"), false);
  }

  it("resolves a PUBLISHED item through publishedVersionId", async () => {
    const created = await publishApproved({
      title: "Public live title",
      body: articleBody("public-live-body"),
    });

    const article = await getPublicArticleBySlug(created.slug);
    assert.equal(article !== null, true);
    if (!article) {
      return;
    }
    assert.equal(article.id, created.contentItemId);
    assert.equal(article.slug, created.slug);
    assert.equal(created.published.slug, created.slug);
    assert.equal(article.title, "Public live title");
    assert.equal(article.subtitle, null);
    assert.deepEqual(article.body, articleBody("public-live-body"));
    assert.equal(article.publishedAt instanceof Date, true);
    assert.equal(article.categories[0]?.isPrimary, true);
    assert.equal(article.authors[0]?.displayName, "Author One");
    assert.deepEqual(article.gallery, []);
    assertNoInternalLeak(article);
  });

  it("resolves published version hero media as a public-safe URL", async () => {
    const created = await publishApproved({
      title: "Public hero title",
      body: articleBody("public-hero-body"),
    });

    const article = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(article !== null, true);
    if (!article) {
      return;
    }
    assert.deepEqual(article.hero, {
      url: `https://media.example.test/assets/itest/${fixture.ids.media}`,
      width: null,
      height: null,
      altText: "alt",
      credit: "cred",
    });
    assertNoInternalLeak(article);
  });

  it("does not substitute a newer draft for the published version", async () => {
    const created = await publishApproved({
      title: "Published title",
      body: articleBody("published-body"),
    });
    const revision = await createDraftRevision(
      created.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      title: "Draft title must not leak",
      body: articleBody("draft-body-must-not-leak"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
      media: [
        {
          mediaId: fixture.ids.extraMedia,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          altText: "draft alt must not leak",
          credit: "draft credit must not leak",
        },
      ],
      authors: [
        {
          authorId: fixture.ids.extraAuthor,
          role: AUTHOR_ROLE.AUTHOR,
          sortOrder: 0,
        },
      ],
    });

    const article = await getPublicArticleBySlug(created.slug);
    assert.equal(article?.title, "Published title");
    assert.deepEqual(article?.body, articleBody("published-body"));
    assert.equal(article?.categories[0]?.name, "Category A");
    assert.equal(
      article?.categories.some((category) => category.name === "Category B"),
      false,
    );
    assert.equal(article?.authors[0]?.displayName, "Author One");
    assert.equal(
      article?.authors.some((author) => author.displayName === "Author Two"),
      false,
    );

    const withHero = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(
      withHero?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
    assert.equal(withHero?.hero?.altText, "alt");

    const draft = await snapshotContent(created.contentItemId, revision.versionId);
    assert.equal(draft.workflowStatus, WORKFLOW_STATUS.DRAFT);
    assert.equal(draft.title, "Draft title must not leak");
  });

  it("does not resolve an UNPUBLISHED item that still has publishedVersionId", async () => {
    const created = await publishApproved({
      title: "Withdrawn title",
      body: articleBody("withdrawn-body"),
    });
    const unpublished = await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    const item = await getContentItem(created.contentItemId);
    assert.equal(unpublished.slug, created.slug);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(item.publishedVersionId, created.versionId);
    assert.equal(await getPublicArticleBySlug(created.slug), null);
  });

  it("does not resolve a NEVER_PUBLISHED item", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Never published",
      body: articleBody("never-published-body"),
    });
    const item = await getContentItem(created.contentItemId);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.NEVER_PUBLISHED);
    assert.equal(await getPublicArticleBySlug(created.slug), null);
  });

  it("does not expose a scheduled replacement before publication", async () => {
    const created = await publishApproved({
      title: "Still live",
      body: articleBody("still-live"),
    });
    const revision = await createDraftRevision(
      created.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    const saved = await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      title: "Scheduled replacement title",
      body: articleBody("scheduled-replacement-body"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
      media: [
        {
          mediaId: fixture.ids.extraMedia,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          altText: "scheduled alt must not leak",
        },
      ],
    });
    const submitted = await submitForReview(created.contentItemId, revision.versionId, {
      expectedUpdatedAt: saved.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    await approveVersion(created.contentItemId, revision.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    const now = new Date();
    await scheduleVersion(
      created.contentItemId,
      revision.versionId,
      new Date(now.getTime() + 60_000),
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
      now,
    );

    const item = await getContentItem(created.contentItemId);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(item.publishedVersionId, created.versionId);
    assert.equal(item.scheduledVersionId, revision.versionId);

    const article = await getPublicArticleBySlug(created.slug);
    assert.equal(article?.title, "Still live");
    assert.deepEqual(article?.body, articleBody("still-live"));

    const withHero = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(
      withHero?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
    assert.equal(withHero?.hero?.altText, "alt");

    const executed = await executeScheduledPublish(
      created.contentItemId,
      item.scheduleGeneration,
      new Date(now.getTime() + 120_000),
    );
    assert.equal(executed.outcome, SCHEDULED_PUBLISH_DECISION.EXECUTE);
    if (executed.outcome !== SCHEDULED_PUBLISH_DECISION.EXECUTE) {
      return;
    }
    assert.equal(executed.publish.slug, created.slug);

    const replaced = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(replaced?.title, "Scheduled replacement title");
    assert.deepEqual(replaced?.body, articleBody("scheduled-replacement-body"));
    assert.equal(
      replaced?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.extraMedia}`,
    );
    assert.equal(replaced?.hero?.altText, "scheduled alt must not leak");
  });

  it("returns null hero when the published article has no hero media", async () => {
    const created = await publishApproved({
      title: "No hero title",
      body: articleBody("no-hero-body"),
      includeRelations: false,
    });

    const article = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(article?.title, "No hero title");
    assert.equal(article?.hero, null);
    assert.deepEqual(article?.gallery, []);
  });

  it("rejects non-image hero media for the public article contract", async () => {
    const created = await publishApproved({
      title: "Video hero title",
      body: articleBody("video-hero-body"),
    });
    await getDb()
      .update(media)
      .set({ mediaType: MEDIA_TYPE.VIDEO, mimeType: "video/mp4" })
      .where(eq(media.id, fixture.ids.media));

    const article = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(article?.title, "Video hero title");
    assert.equal(article?.hero, null);
  });

  it("loads version-owned relations and body from the published version only", async () => {
    const created = await publishApproved({
      title: "Relation source",
      body: articleBody("relation-source-body"),
    });
    const published = await snapshotContent(created.contentItemId, created.versionId);
    const article = await getPublicArticleBySlug(created.slug);
    assert.equal(article?.title, published.title);
    assert.deepEqual(article?.body, published.body);
    assert.equal(article?.categories.length > 0, true);
    assert.equal(article?.authors.length, 1);
    assert.equal(article?.authors[0]?.role, AUTHOR_ROLE.AUTHOR);
  });

  it("resolves published gallery only, in order, and without internal fields", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Public gallery title",
      body: articleBody("public-gallery-body"),
    });
    const assigned = await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      items: [
        { mediaId: fixture.ids.extraMedia, caption: "Second", credit: "Desk" },
        { mediaId: fixture.ids.media, caption: "First" },
      ],
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const submitted = await submitForReview(
      created.contentItemId,
      created.versionId,
      {
        expectedUpdatedAt: assigned.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(created.contentItemId, created.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const unresolved = await getPublicArticleBySlug(created.slug);
    assert.deepEqual(unresolved?.gallery, []);

    const article = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.deepEqual(
      article?.gallery.map((item) => ({
        mediaId: item.mediaId,
        caption: item.caption,
        credit: item.credit,
      })),
      [
        {
          mediaId: fixture.ids.extraMedia,
          caption: "Second",
          credit: "Desk",
        },
        {
          mediaId: fixture.ids.media,
          caption: "First",
          credit: null,
        },
      ],
    );
    assert.equal(
      article?.gallery[1]?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
    if (article) {
      assertNoInternalLeak(article);
    }

    const revision = await createDraftRevision(
      created.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      items: [{ mediaId: fixture.ids.media, caption: "Draft only" }],
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const stillPublished = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.deepEqual(
      stillPublished?.gallery.map((item) => item.caption),
      ["Second", "First"],
    );
  });

  it("returns not-found for unknown and malformed slugs", async () => {
    assert.equal(await getPublicArticleBySlug("no-such-public-article"), null);
    assert.equal(await getPublicArticleBySlug("Hello World"), null);
    assert.equal(await getPublicArticleBySlug(""), null);
    assert.equal(await getPublicArticleBySlug("../secret"), null);
  });
});
