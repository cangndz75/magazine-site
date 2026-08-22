import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  AUTHOR_ROLE,
  CONTENT_KIND,
  CONTENT_LEGAL_ACTION_TYPE,
  CONTENT_LEGAL_REASON_CATEGORY,
  MEDIA_LICENSE_TYPE,
  MEDIA_ROLE,
  MEDIA_SOURCE_KIND,
  MEDIA_TYPE,
  MEDIA_USAGE_RESTRICTION,
  PUBLIC_HOMEPAGE_GALLERY_LIMIT,
  PUBLISHING_ERROR,
  PublishingError,
  PUBLICATION_STATUS,
} from "@magazine/domain";
import { eq } from "drizzle-orm";
import { getDb } from "../client";
import {
  getPublicArticleBySlug,
  getPublicHomepage,
  getPublicPhotoGalleryBySlug,
} from "../public";
import {
  approveVersion,
  createContent,
  getContentItem,
  publishVersion,
  recordContentLegalAction,
  setDraftVersionGallery,
  submitForReview,
  unpublishContent,
} from "../publishing";
import { contentItems, media } from "../schema";
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

const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";

describe("photo gallery content-kind PostgreSQL", () => {
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
  });

  after(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const leftoverTx = await countOpenTestTransactions();
    assert.equal(leftoverTx, 0, "integration tests leaked open transactions");
    await closeIntegrationConnections();
  });

  async function grantPublicRights(mediaId: string) {
    await getDb()
      .update(media)
      .set({
        sourceKind: MEDIA_SOURCE_KIND.OWNED,
        rightsHolder: "Fixture Rights",
        licenseType: MEDIA_LICENSE_TYPE.ALL_RIGHTS,
        creditLine: "Fixture Credit",
        usageRestriction: MEDIA_USAGE_RESTRICTION.NONE,
      })
      .where(eq(media.id, mediaId));
  }

  async function insertImage() {
    const id = randomUUID();
    await getDb().insert(media).values({
      id,
      storageKey: `itest/gallery-${id}`,
      mediaType: MEDIA_TYPE.IMAGE,
      mimeType: "image/jpeg",
      width: 1200,
      height: 800,
      byteSize: 2048,
      originalFilename: "gallery.jpg",
      creditLine: "Library credit",
    });
    await grantPublicRights(id);
    return id;
  }

  async function createGalleryDraft(input: {
    title: string;
    galleryMediaIds: string[];
  }) {
    await grantPublicRights(fixture.ids.media);
    for (const mediaId of input.galleryMediaIds) {
      await grantPublicRights(mediaId);
    }
    const created = await createContent({
      contentKind: CONTENT_KIND.GALLERY,
      slug: uniqueSlug("photogallery"),
      title: input.title,
      body: articleBody(`${input.title}-body`),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
      media: [
        {
          mediaId: fixture.ids.media,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          altText: "cover alt",
          credit: "cover credit",
        },
        ...input.galleryMediaIds.map((mediaId, index) => ({
          mediaId,
          role: MEDIA_ROLE.GALLERY,
          sortOrder: index,
          caption: `caption-${index + 1}`,
          altText: `alt-${index + 1}`,
          credit: `credit-${index + 1}`,
        })),
      ],
      authors: [
        {
          authorId: fixture.ids.author,
          role: AUTHOR_ROLE.AUTHOR,
          sortOrder: 0,
        },
      ],
    });
    fixture.createdItemIds.push(created.contentItemId);
    return created;
  }

  async function publishGallery(created: {
    contentItemId: string;
    versionId: string;
    updatedAt: Date;
  }) {
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
    return publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
  }

  it("persists omitted contentKind as ARTICLE for historical-compatible creates", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title: "Pre-gallery article",
    });
    const [row] = await getDb()
      .select({ contentKind: contentItems.contentKind })
      .from(contentItems)
      .where(eq(contentItems.id, created.contentItemId))
      .limit(1);
    assert.equal(row?.contentKind, CONTENT_KIND.ARTICLE);
    const item = await getContentItem(created.contentItemId);
    assert.equal(item.contentKind, CONTENT_KIND.ARTICLE);
  });

  it("persists GALLERY separately from ARTICLE and publishes the exact approved version", async () => {
    const extra = await insertImage();
    const created = await createGalleryDraft({
      title: "Published gallery identity",
      galleryMediaIds: [extra],
    });
    const published = await publishGallery(created);
    const item = await getContentItem(created.contentItemId);
    assert.equal(item.contentKind, CONTENT_KIND.GALLERY);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(item.publishedVersionId, created.versionId);
    assert.equal(published.publishedVersionId, created.versionId);

    const publicGallery = await getPublicPhotoGalleryBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(publicGallery?.publishedVersionId, created.versionId);
    assert.equal(await getPublicArticleBySlug(created.slug), null);
  });

  it("projects five ordered gallery images without hydrating article routes", async () => {
    const images = [];
    for (let index = 0; index < 5; index += 1) {
      images.push(await insertImage());
    }
    const created = await createGalleryDraft({
      title: "Five image gallery",
      galleryMediaIds: images,
    });
    await publishGallery(created);
    const publicGallery = await getPublicPhotoGalleryBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(publicGallery?.images.length, 5);
    assert.deepEqual(
      publicGallery?.images.map((item) => item.caption),
      ["caption-1", "caption-2", "caption-3", "caption-4", "caption-5"],
    );
    assert.equal(publicGallery?.cover.altText, "cover alt");
    const serialized = JSON.stringify(publicGallery);
    assert.equal(serialized.includes("storageKey"), false);
    assert.equal(serialized.includes("licenseNote"), false);
    assert.equal(serialized.includes("rightsHolder"), false);
    assert.equal(serialized.includes("internalNote"), false);
    assert.equal(await getPublicArticleBySlug(created.slug), null);
  });

  it("does not leak IN_REVIEW, APPROVED, unpublished, retracted, or takedown galleries", async () => {
    const extra = await insertImage();
    const review = await createGalleryDraft({
      title: "In review gallery",
      galleryMediaIds: [extra],
    });
    await submitForReview(review.contentItemId, review.versionId, {
      expectedUpdatedAt: review.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    assert.equal(await getPublicPhotoGalleryBySlug(review.slug), null);

    const approved = await createGalleryDraft({
      title: "Approved unpublished gallery",
      galleryMediaIds: [extra],
    });
    const submitted = await submitForReview(
      approved.contentItemId,
      approved.versionId,
      {
        expectedUpdatedAt: approved.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(approved.contentItemId, approved.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    const approvedItem = await getContentItem(approved.contentItemId);
    assert.equal(approvedItem.publicationStatus, PUBLICATION_STATUS.NEVER_PUBLISHED);
    assert.equal(await getPublicPhotoGalleryBySlug(approved.slug), null);

    const live = await createGalleryDraft({
      title: "Live gallery for withdrawal",
      galleryMediaIds: [extra],
    });
    const published = await publishGallery(live);
    await unpublishContent(
      live.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    assert.equal(await getPublicPhotoGalleryBySlug(live.slug), null);

    const retracted = await createGalleryDraft({
      title: "Retracted gallery",
      galleryMediaIds: [extra],
    });
    const retractedPublished = await publishGallery(retracted);
    await recordContentLegalAction({
      contentItemId: retracted.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.EDITORIAL_STANDARDS,
      internalNote: "gallery internal retraction note",
      publicNote: "Retracted gallery notice",
      expectedUpdatedAt: retractedPublished.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    const retractedPublic = await getPublicPhotoGalleryBySlug(retracted.slug);
    assert.equal(retractedPublic, null);
    assert.equal(
      JSON.stringify(retractedPublic).includes("gallery internal retraction note"),
      false,
    );

    const takedown = await createGalleryDraft({
      title: "Takedown gallery",
      galleryMediaIds: [extra],
    });
    const takedownPublished = await publishGallery(takedown);
    await recordContentLegalAction({
      contentItemId: takedown.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
      internalNote: "gallery internal takedown note",
      expectedUpdatedAt: takedownPublished.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    assert.equal(await getPublicPhotoGalleryBySlug(takedown.slug), null);
    assert.equal(published.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
  });

  it("keeps homepage gallery cards bounded, recency-ordered, and compact", async () => {
    const extras = [];
    for (let index = 0; index < 5; index += 1) {
      extras.push(await insertImage());
    }
    const published = [];
    for (const [index, extra] of extras.entries()) {
      const created = await createGalleryDraft({
        title: `Homepage gallery ${index + 1}`,
        galleryMediaIds: [extra],
      });
      await publishGallery(created);
      published.push(created);
    }
    const base = Date.now() + 400_000;
    for (const [index, item] of published.entries()) {
      await getDb()
        .update(contentItems)
        .set({ publishedAt: new Date(base + index * 1000) })
        .where(eq(contentItems.id, item.contentItemId));
    }

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(PUBLIC_HOMEPAGE_GALLERY_LIMIT, 4);
    assert.equal(homepage.galleries.length, 4);
    assert.deepEqual(
      homepage.galleries.map((item) => item.title),
      [
        "Homepage gallery 5",
        "Homepage gallery 4",
        "Homepage gallery 3",
        "Homepage gallery 2",
      ],
    );
    assert.equal(
      homepage.galleries.some((item) => item.title === "Homepage gallery 1"),
      false,
    );
    assert.equal(homepage.lead?.id === published[4]?.contentItemId, false);
    const card = homepage.galleries[0];
    assert.equal(card?.imageCount, 1);
    assert.equal("images" in (card ?? {}), false);
    const serialized = JSON.stringify(homepage.galleries);
    assert.equal(serialized.includes("storageKey"), false);
    assert.equal(serialized.includes("workflowStatus"), false);
  });

  it("rejects a stale gallery reorder and keeps the first accepted order", async () => {
    const first = await insertImage();
    const second = await insertImage();
    const created = await createGalleryDraft({
      title: "Concurrent gallery reorder",
      galleryMediaIds: [first, second],
    });
    const accepted = await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      items: [
        { mediaId: second, caption: "second-first" },
        { mediaId: first, caption: "first-second" },
      ],
    });
    await assert.rejects(
      () =>
        setDraftVersionGallery({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffReviewerA,
          mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
          items: [
            { mediaId: first, caption: "stale-first" },
            { mediaId: second, caption: "stale-second" },
          ],
        }),
      (error) =>
        error instanceof PublishingError &&
        error.code === PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT,
    );
    const item = await getContentItem(created.contentItemId);
    assert.equal(item.updatedAt.getTime(), accepted.updatedAt.getTime());
    assert.deepEqual(
      accepted.gallery.map((row) => row.id),
      [second, first],
    );
  });

  it("does not let an ARTICLE occupy the gallery public route", async () => {
    const article = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Ordinary article",
    });
    const submitted = await submitForReview(
      article.contentItemId,
      article.versionId,
      {
        expectedUpdatedAt: article.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(article.contentItemId, article.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await publishVersion(
      article.contentItemId,
      article.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    assert.equal(await getPublicPhotoGalleryBySlug(article.slug), null);
    assert.equal((await getPublicArticleBySlug(article.slug))?.title, "Ordinary article");
  });
});
