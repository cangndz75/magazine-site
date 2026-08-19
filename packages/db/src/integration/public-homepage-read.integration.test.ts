import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  AUTHOR_ROLE,
  HOMEPAGE_GALLERY_DATA_SOURCE_NOT_YET_AVAILABLE,
  HOMEPAGE_VIDEO_DATA_SOURCE_NOT_YET_AVAILABLE,
  MEDIA_ROLE,
  PUBLIC_HOMEPAGE_FEATURED_LIMIT,
  PUBLICATION_STATUS,
  SCHEDULED_PUBLISH_DECISION,
  WORKFLOW_STATUS,
} from "@magazine/domain";
import { eq } from "drizzle-orm";
import { getDb } from "../client";
import {
  PUBLIC_HOMEPAGE_LEAD_SLICE_SIZE,
  PUBLIC_HOMEPAGE_TEMPORARY_STORY_QUERY_LIMIT,
  getPublicHomepage,
  selectTemporaryHomepageLeadSlice,
  type PublicHomepage,
  type PublicHomepageStory,
} from "../public";
import {
  approveVersion,
  createDraftRevision,
  executeScheduledPublish,
  getContentItem,
  publishVersion,
  scheduleVersion,
  submitForReview,
  unpublishContent,
  updateDraftContent,
} from "../publishing";
import { contentItems } from "../schema";
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

const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";

describe("public homepage read PostgreSQL", () => {
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

  async function stampPublishedAt(contentItemId: string, publishedAt: Date) {
    await getDb()
      .update(contentItems)
      .set({ publishedAt })
      .where(eq(contentItems.id, contentItemId));
  }

  function homepageStories(homepage: PublicHomepage): PublicHomepageStory[] {
    return homepage.lead ? [homepage.lead, ...homepage.supports] : [...homepage.supports];
  }

  function assertNoInternalLeak(value: object): void {
    const serialized = JSON.stringify(value);
    assert.equal(serialized.includes("workflowStatus"), false);
    assert.equal(serialized.includes("draftVersionId"), false);
    assert.equal(serialized.includes("scheduledVersionId"), false);
    assert.equal(serialized.includes("scheduleGeneration"), false);
    assert.equal(serialized.includes("publicationStatus"), false);
    assert.equal(serialized.includes("legalHold"), false);
    assert.equal(serialized.includes("storageKey"), false);
    assert.equal(serialized.includes("mimeType"), false);
    assert.equal(serialized.includes("byteSize"), false);
    assert.equal(serialized.includes("\"body\""), false);
    assert.equal(serialized.includes("blocks"), false);
  }

  it("selectTemporaryHomepageLeadSlice is a bounded unique split", () => {
    const slice = selectTemporaryHomepageLeadSlice(["a", "b", "c", "d"]);
    assert.equal(slice.lead, "a");
    assert.deepEqual(slice.supports, ["b", "c"]);
    assert.equal(PUBLIC_HOMEPAGE_LEAD_SLICE_SIZE, 3);
  });

  it("returns an empty conversation rail when no editorial items exist", async () => {
    const created = await publishApproved({
      title: "Homepage conversation empty rail",
      body: articleBody("homepage-conversation-empty-rail"),
    });
    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.deepEqual(homepage.conversation, []);
    assert.equal(
      homepageStories(homepage).some((story) => story.id === created.contentItemId),
      true,
    );
    assertNoInternalLeak(homepage);
  });

  it("uses publishedVersionId fields for lead and supports", async () => {
    const first = await publishApproved({
      title: "Homepage older",
      body: articleBody("homepage-older-body"),
    });
    const second = await publishApproved({
      title: "Homepage newer",
      body: articleBody("homepage-newer-body"),
    });
    const third = await publishApproved({
      title: "Homepage newest",
      body: articleBody("homepage-newest-body"),
    });
    const base = Date.now() + 60_000;
    await stampPublishedAt(first.contentItemId, new Date(base));
    await stampPublishedAt(second.contentItemId, new Date(base + 1000));
    await stampPublishedAt(third.contentItemId, new Date(base + 2000));

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(homepage.lead?.id, third.contentItemId);
    assert.equal(homepage.lead?.title, "Homepage newest");
    assert.equal(homepage.lead?.slug, third.slug);
    assert.equal(homepage.supports[0]?.id, second.contentItemId);
    assert.equal(homepage.supports[1]?.id, first.contentItemId);
    assert.equal(homepage.lead?.primaryCategory?.name, "Category A");
    assert.equal(
      homepage.lead?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
    assert.equal(homepage.lead?.hero?.altText, "alt");
    assert.equal(homepage.lead?.hero?.credit, "cred");
    assertNoInternalLeak(homepage);
  });

  it("returns unique lead and support stories within the bounded slice", async () => {
    const published = [];
    for (const title of ["Bound one", "Bound two", "Bound three", "Bound four"]) {
      published.push(
        await publishApproved({
          title,
          body: articleBody(`${title}-body`),
        }),
      );
    }
    const base = Date.now() + 120_000;
    for (const [index, item] of published.entries()) {
      await stampPublishedAt(item.contentItemId, new Date(base + index * 1000));
    }

    const homepage = await getPublicHomepage();
    const stories = homepageStories(homepage);
    assert.equal(stories.length <= PUBLIC_HOMEPAGE_LEAD_SLICE_SIZE, true);
    const ids = stories.map((story) => story.id);
    assert.equal(new Set(ids).size, ids.length);
    const newestThree = new Set(
      published.slice(-3).map((item) => item.contentItemId),
    );
    for (const id of newestThree) {
      assert.equal(ids.includes(id), true);
    }
    assert.equal(ids.includes(published[0].contentItemId), false);
  });

  it("ignores NEVER_PUBLISHED content", async () => {
    const live = await publishApproved({
      title: "Homepage live eligible",
      body: articleBody("homepage-live-eligible"),
    });
    const draftOnly = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Never published homepage",
      body: articleBody("never-published-homepage"),
    });
    const item = await getContentItem(draftOnly.contentItemId);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.NEVER_PUBLISHED);

    const homepage = await getPublicHomepage();
    const ids = homepageStories(homepage).map((story) => story.id);
    assert.equal(ids.includes(live.contentItemId), true);
    assert.equal(ids.includes(draftOnly.contentItemId), false);
  });

  it("does not keep unpublished content on the homepage", async () => {
    const withdrawn = await publishApproved({
      title: "Homepage withdrawn",
      body: articleBody("homepage-withdrawn"),
    });
    const remaining = await publishApproved({
      title: "Homepage remaining",
      body: articleBody("homepage-remaining"),
    });
    await unpublishContent(
      withdrawn.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    const item = await getContentItem(withdrawn.contentItemId);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(item.publishedVersionId, withdrawn.versionId);

    const homepage = await getPublicHomepage();
    const ids = homepageStories(homepage).map((story) => story.id);
    assert.equal(ids.includes(withdrawn.contentItemId), false);
    assert.equal(ids.includes(remaining.contentItemId), true);
  });

  it("does not return deleted content", async () => {
    const deleted = await publishApproved({
      title: "Homepage deleted",
      body: articleBody("homepage-deleted"),
    });
    const remaining = await publishApproved({
      title: "Homepage after delete",
      body: articleBody("homepage-after-delete"),
    });
    await getDb()
      .update(contentItems)
      .set({ deletedAt: new Date() })
      .where(eq(contentItems.id, deleted.contentItemId));

    const homepage = await getPublicHomepage();
    const ids = homepageStories(homepage).map((story) => story.id);
    assert.equal(ids.includes(deleted.contentItemId), false);
    assert.equal(ids.includes(remaining.contentItemId), true);
  });

  it("newer draft cannot alter homepage title, hero, or category", async () => {
    const created = await publishApproved({
      title: "Published homepage title",
      body: articleBody("published-homepage-body"),
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
      title: "Draft homepage title must not leak",
      body: articleBody("draft-homepage-body-must-not-leak"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
      media: [
        {
          mediaId: fixture.ids.extraMedia,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          altText: "draft homepage alt must not leak",
          credit: "draft homepage credit must not leak",
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

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const story = homepageStories(homepage).find(
      (candidate) => candidate.id === created.contentItemId,
    );
    assert.equal(story !== undefined, true);
    assert.equal(story?.title, "Published homepage title");
    assert.equal(story?.primaryCategory?.name, "Category A");
    assert.equal(
      story?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
    assert.equal(story?.hero?.altText, "alt");
    assert.equal("body" in (story ?? {}), false);

    const draft = await snapshotContent(created.contentItemId, revision.versionId);
    assert.equal(draft.workflowStatus, WORKFLOW_STATUS.DRAFT);
    assert.equal(draft.title, "Draft homepage title must not leak");
  });

  it("does not expose a scheduled replacement on the homepage before publication", async () => {
    const created = await publishApproved({
      title: "Still live homepage",
      body: articleBody("still-live-homepage"),
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
      title: "Scheduled homepage replacement",
      body: articleBody("scheduled-homepage-replacement-body"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
      media: [
        {
          mediaId: fixture.ids.extraMedia,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          altText: "scheduled homepage alt must not leak",
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

    const before = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const beforeStory = homepageStories(before).find(
      (candidate) => candidate.id === created.contentItemId,
    );
    assert.equal(beforeStory?.title, "Still live homepage");
    assert.equal(
      beforeStory?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
    assert.equal(beforeStory?.hero?.altText, "alt");

    const executed = await executeScheduledPublish(
      created.contentItemId,
      item.scheduleGeneration,
      new Date(now.getTime() + 120_000),
    );
    assert.equal(executed.outcome, SCHEDULED_PUBLISH_DECISION.EXECUTE);

    const after = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const afterStory = homepageStories(after).find(
      (candidate) => candidate.id === created.contentItemId,
    );
    assert.equal(afterStory?.title, "Scheduled homepage replacement");
    assert.equal(
      afterStory?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.extraMedia}`,
    );
    assert.equal(afterStory?.hero?.altText, "scheduled homepage alt must not leak");
  });

  it("keeps published stories without hero instead of fabricating imagery", async () => {
    const created = await publishApproved({
      title: "Homepage no hero",
      body: articleBody("homepage-no-hero"),
      includeRelations: false,
    });

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const story = homepageStories(homepage).find(
      (candidate) => candidate.id === created.contentItemId,
    );
    assert.equal(story?.title, "Homepage no hero");
    assert.equal(story?.hero, null);
    assert.equal(story?.primaryCategory?.name, "Category A");
  });

  async function publishRanked(titles: string[]) {
    const published = [];
    for (const title of titles) {
      published.push(
        await publishApproved({
          title,
          body: articleBody(`${title}-body`),
        }),
      );
    }
    const base = Date.now() + 300_000;
    for (const [index, item] of published.entries()) {
      await stampPublishedAt(item.contentItemId, new Date(base + index * 1000));
    }
    return published;
  }

  it("keeps video and galleries absent because those data sources do not exist", async () => {
    await publishApproved({
      title: "Homepage modules absent",
      body: articleBody("homepage-modules-absent"),
    });
    const homepage = await getPublicHomepage();
    assert.equal(homepage.video, null);
    assert.deepEqual(homepage.galleries, []);
    assert.equal(
      HOMEPAGE_VIDEO_DATA_SOURCE_NOT_YET_AVAILABLE,
      "HOMEPAGE_VIDEO_DATA_SOURCE_NOT_YET_AVAILABLE",
    );
    assert.equal(
      HOMEPAGE_GALLERY_DATA_SOURCE_NOT_YET_AVAILABLE,
      "HOMEPAGE_GALLERY_DATA_SOURCE_NOT_YET_AVAILABLE",
    );
    assertNoInternalLeak(homepage);
  });

  it("does not treat published GALLERY media attachments as homepage galleries", async () => {
    const created = await publishApproved({
      title: "Article with gallery attachments",
      body: articleBody("article-with-gallery-attachments"),
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
      title: "Article with gallery attachments",
      body: articleBody("article-with-gallery-attachments-v2"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
      media: [
        {
          mediaId: fixture.ids.media,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          altText: "alt",
          credit: "cred",
        },
        {
          mediaId: fixture.ids.extraMedia,
          role: MEDIA_ROLE.GALLERY,
          sortOrder: 1,
          caption: "gallery",
          altText: "gallery-alt",
          credit: "gallery-cred",
        },
      ],
      authors: [
        {
          authorId: fixture.ids.author,
          role: AUTHOR_ROLE.AUTHOR,
          sortOrder: 0,
        },
      ],
    });
    const submitted = await submitForReview(
      created.contentItemId,
      revision.versionId,
      {
        expectedUpdatedAt: saved.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(created.contentItemId, revision.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await publishVersion(
      created.contentItemId,
      revision.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const homepage = await getPublicHomepage();
    assert.deepEqual(homepage.galleries, []);
    assert.equal(homepage.video, null);
  });

  it("selects featured from remaining published stories after lead and supports", async () => {
    const published = await publishRanked([
      "Featured oldest",
      "Featured two",
      "Featured three",
      "Featured four",
      "Featured newest of five",
      "Support older",
      "Support newer",
      "Lead story",
    ]);
    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(homepage.lead?.id, published[7]?.contentItemId);
    assert.deepEqual(
      homepage.supports.map((story) => story.id),
      [published[6]?.contentItemId, published[5]?.contentItemId],
    );
    assert.deepEqual(
      homepage.featured.map((story) => story.id),
      [
        published[4]?.contentItemId,
        published[3]?.contentItemId,
        published[2]?.contentItemId,
        published[1]?.contentItemId,
        published[0]?.contentItemId,
      ],
    );
    const atfIds = new Set(
      homepageStories(homepage).map((story) => story.id),
    );
    for (const story of homepage.featured) {
      assert.equal(atfIds.has(story.id), false);
    }
    assert.equal(homepage.featured[0]?.title, "Featured newest of five");
    assert.equal(homepage.featured[0]?.primaryCategory?.name, "Category A");
    assert.equal(
      homepage.featured[0]?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
    assertNoInternalLeak(homepage);
  });

  it("ignores NEVER_PUBLISHED content in featured", async () => {
    const published = await publishRanked([
      "Featured eligible one",
      "Support B",
      "Support A",
      "Lead eligible",
    ]);
    const draftOnly = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Never published featured",
      body: articleBody("never-published-featured"),
    });
    const homepage = await getPublicHomepage();
    const featuredIds = homepage.featured.map((story) => story.id);
    assert.equal(featuredIds.includes(published[0]!.contentItemId), true);
    assert.equal(featuredIds.includes(draftOnly.contentItemId), false);
  });

  it("does not keep unpublished content in featured", async () => {
    const published = await publishRanked([
      "Featured remaining",
      "Featured withdrawn",
      "Support B",
      "Support A",
      "Lead live",
    ]);
    await unpublishContent(
      published[1]!.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    const homepage = await getPublicHomepage();
    const featuredIds = homepage.featured.map((story) => story.id);
    assert.equal(featuredIds.includes(published[1]!.contentItemId), false);
    assert.equal(featuredIds.includes(published[0]!.contentItemId), true);
  });

  it("does not return deleted content in featured", async () => {
    const published = await publishRanked([
      "Featured remaining after delete",
      "Featured deleted",
      "Support B",
      "Support A",
      "Lead live",
    ]);
    await getDb()
      .update(contentItems)
      .set({ deletedAt: new Date() })
      .where(eq(contentItems.id, published[1]!.contentItemId));

    const homepage = await getPublicHomepage();
    const featuredIds = homepage.featured.map((story) => story.id);
    assert.equal(featuredIds.includes(published[1]!.contentItemId), false);
    assert.equal(featuredIds.includes(published[0]!.contentItemId), true);
  });

  it("newer draft cannot alter featured title or hero", async () => {
    const published = await publishRanked([
      "Published featured title",
      "Support B",
      "Support A",
      "Lead live",
    ]);
    const featuredItem = published[0]!;
    const revision = await createDraftRevision(
      featuredItem.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    await updateDraftContent({
      contentItemId: featuredItem.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      title: "Draft featured title must not leak",
      body: articleBody("draft-featured-body-must-not-leak"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
      media: [
        {
          mediaId: fixture.ids.extraMedia,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          altText: "draft featured alt must not leak",
          credit: "draft featured credit must not leak",
        },
      ],
    });

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const story = homepage.featured.find(
      (candidate) => candidate.id === featuredItem.contentItemId,
    );
    assert.equal(story !== undefined, true);
    assert.equal(story?.title, "Published featured title");
    assert.equal(story?.primaryCategory?.name, "Category A");
    assert.equal(
      story?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
    assert.equal(story?.hero?.altText, "alt");
    assert.equal("body" in (story ?? {}), false);

    const draft = await snapshotContent(
      featuredItem.contentItemId,
      revision.versionId,
    );
    assert.equal(draft.workflowStatus, WORKFLOW_STATUS.DRAFT);
    assert.equal(draft.title, "Draft featured title must not leak");
  });

  it("caps featured at 5 with deterministic recency order", async () => {
    const published = await publishRanked([
      "Too old for featured",
      "Featured bound five",
      "Featured bound four",
      "Featured bound three",
      "Featured bound two",
      "Featured bound one",
      "Support B",
      "Support A",
      "Lead live",
    ]);
    const homepage = await getPublicHomepage();
    assert.equal(PUBLIC_HOMEPAGE_FEATURED_LIMIT, 5);
    assert.equal(
      PUBLIC_HOMEPAGE_TEMPORARY_STORY_QUERY_LIMIT,
      PUBLIC_HOMEPAGE_LEAD_SLICE_SIZE + PUBLIC_HOMEPAGE_FEATURED_LIMIT,
    );
    assert.equal(homepage.featured.length, 5);
    assert.deepEqual(
      homepage.featured.map((story) => story.id),
      [
        published[5]?.contentItemId,
        published[4]?.contentItemId,
        published[3]?.contentItemId,
        published[2]?.contentItemId,
        published[1]?.contentItemId,
      ],
    );
    assert.equal(
      homepage.featured.some((story) => story.id === published[0]?.contentItemId),
      false,
    );
    assertNoInternalLeak(homepage);
  });
});
