import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  HOMEPAGE_AUDIT_EVENT_TYPE,
  HOMEPAGE_BUILDER_ERROR,
  HOMEPAGE_CONFIG_ID,
  HOMEPAGE_SLOT_KEY,
  HomepageBuilderError,
  assertHomepageSlotAssignmentsUnique,
  nextMonotonicUpdatedAt,
} from "@magazine/domain";
import { eq } from "drizzle-orm";
import { getDb } from "../client";
import {
  clearHomepageSlot,
  getHomepageBuilder,
  moveHomepageFeaturedSlot,
  publishHomepage,
  setHomepageSlot,
} from "../editor";
import { getPublicHomepage } from "../public";
import {
  approveVersion,
  createDraftRevision,
  publishVersion,
  scheduleVersion,
  submitForReview,
  unpublishContent,
  updateDraftContent,
} from "../publishing";
import { contentItems, homepageAuditEvents } from "../schema";
import {
  articleBody,
  cleanupFixture,
  closeIntegrationConnections,
  countLeftoverFixtures,
  countOpenTestTransactions,
  createDraftItem,
  createFixture,
  ensureEditorContentTestDatabase,
  getRacerPool,
  selectedEditorScope,
  waitUntilBlockedByHolder,
  type IntegrationFixture,
} from "./harness";

const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";

describe("homepage builder PostgreSQL", () => {
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

  async function openBuilder() {
    return getHomepageBuilder(fixture.superAdmin, fixture.ids.staffEditor);
  }

  async function publishMany(count: number, titlePrefix = "Builder article") {
    const published: Awaited<ReturnType<typeof publishApproved>>[] = [];
    for (let index = 0; index < count; index += 1) {
      const item = await publishApproved({
        title: `${titlePrefix} ${index + 1}`,
        body: articleBody(`${titlePrefix}-${index + 1}`),
      });
      await stampPublishedAt(
        item.contentItemId,
        new Date(Date.UTC(2026, 0, 1, index, 0, 0)),
      );
      published.push(item);
    }
    return published;
  }

  function allStoryIds(homepage: Awaited<ReturnType<typeof getPublicHomepage>>) {
    const ids = [
      homepage.lead?.id,
      ...homepage.supports.map((story) => story.id),
      ...homepage.featured.map((story) => story.id),
    ].filter((id): id is string => id !== undefined);
    return ids;
  }

  function slotContent(
    state: Awaited<ReturnType<typeof getHomepageBuilder>>,
    slotKey: string,
  ) {
    return (
      state.draft.slots.find((slot) => slot.slotKey === slotKey)?.contentItemId ??
      null
    );
  }

  async function listDraftAuditEvents() {
    const events = await getDb()
      .select({
        eventType: homepageAuditEvents.eventType,
        changeSet: homepageAuditEvents.changeSet,
      })
      .from(homepageAuditEvents);
    return events.filter(
      (event) =>
        event.eventType === HOMEPAGE_AUDIT_EVENT_TYPE.HOMEPAGE_DRAFT_UPDATED,
    );
  }

  it("draft edits do not affect the public homepage before publish", async () => {
    const articles = await publishMany(3);
    const before = await getPublicHomepage();
    assert.equal(before.lead?.id, articles[2]?.contentItemId);

    const builder = await openBuilder();
    await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });

    const after = await getPublicHomepage();
    assert.equal(after.lead?.id, before.lead?.id);
    assert.equal(after.lead?.id, articles[2]?.contentItemId);
  });

  it("publish atomically switches the public composition", async () => {
    const articles = await publishMany(3);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.SUPPORT_1,
      contentItemId: articles[1]?.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    const homepage = await getPublicHomepage();
    assert.equal(homepage.lead?.id, articles[0]?.contentItemId);
    assert.equal(homepage.supports[0]?.id, articles[1]?.contentItemId);
  });

  it("keeps the old published composition until a newer publish succeeds", async () => {
    const articles = await publishMany(4);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    builder = await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[3]?.contentItemId,
    });

    const homepage = await getPublicHomepage();
    assert.equal(homepage.lead?.id, articles[0]?.contentItemId);
  });

  it("does not partially change the public composition when publish validation fails", async () => {
    const articles = await publishMany(2);
    const draftOnly = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title: "Draft only homepage",
      body: articleBody("draft-only-homepage"),
    });

    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    builder = await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.SUPPORT_1,
      contentItemId: draftOnly.contentItemId,
    });

    await assert.rejects(
      () =>
        publishHomepage({
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
          expectedUpdatedAt: builder.updatedAt,
        }),
      (error: unknown) =>
        error instanceof HomepageBuilderError &&
        error.code === HOMEPAGE_BUILDER_ERROR.PUBLISH_VALIDATION_FAILED,
    );

    const homepage = await getPublicHomepage();
    assert.equal(homepage.lead?.id, articles[0]?.contentItemId);
    assert.notEqual(homepage.supports[0]?.id, draftOnly.contentItemId);
  });

  it("supersedes a published composition with a newer published version", async () => {
    const articles = await publishMany(3);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    builder = await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[2]?.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    const homepage = await getPublicHomepage();
    assert.equal(homepage.lead?.id, articles[2]?.contentItemId);
    assert.notEqual(homepage.lead?.id, articles[0]?.contentItemId);
  });

  it("rejects duplicate content item assignments in one composition", async () => {
    const articles = await publishMany(2);
    const builder = await openBuilder();
    await assert.rejects(
      () =>
        setHomepageSlot({
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
          expectedUpdatedAt: builder.updatedAt,
          slotKey: HOMEPAGE_SLOT_KEY.LEAD,
          contentItemId: articles[0]?.contentItemId,
        }).then((state) =>
          setHomepageSlot({
            scope: fixture.superAdmin,
            actorId: fixture.ids.staffEditor,
            expectedUpdatedAt: state.updatedAt,
            slotKey: HOMEPAGE_SLOT_KEY.SUPPORT_1,
            contentItemId: articles[0]?.contentItemId,
          }),
        ),
      (error: unknown) =>
        error instanceof HomepageBuilderError &&
        error.code === HOMEPAGE_BUILDER_ERROR.DUPLICATE_CONTENT_ITEM,
    );
  });

  it("cannot store the same slot twice in one version", async () => {
    const articles = await publishMany(1);
    const builder = await openBuilder();
    const state = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    const leadSlots = state.draft.slots.filter(
      (slot) => slot.slotKey === HOMEPAGE_SLOT_KEY.LEAD,
    );
    assert.equal(leadSlots.length, 1);
    assert.equal(leadSlots[0]?.contentItemId, articles[0]?.contentItemId);
  });

  it("allows partial compositions on draft and publish", async () => {
    const articles = await publishMany(4);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[3]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      contentItemId: articles[0]?.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    const homepage = await getPublicHomepage();
    assert.equal(homepage.lead?.id, articles[3]?.contentItemId);
    assert.equal(homepage.featured[0]?.id, articles[0]?.contentItemId);
    assert.ok(homepage.supports.length > 0);
  });

  it("rejects invalid content item identifiers", async () => {
    const builder = await openBuilder();
    await assert.rejects(
      () =>
        setHomepageSlot({
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
          expectedUpdatedAt: builder.updatedAt,
          slotKey: HOMEPAGE_SLOT_KEY.LEAD,
          contentItemId: randomUUID(),
        }),
      (error: unknown) =>
        error instanceof HomepageBuilderError &&
        error.code === HOMEPAGE_BUILDER_ERROR.INVALID_CONTENT_ITEM,
    );
  });

  it("does not expose deleted assignments on the public homepage", async () => {
    const articles = await publishMany(3);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    await getDb()
      .update(contentItems)
      .set({ deletedAt: new Date() })
      .where(eq(contentItems.id, articles[0]!.contentItemId));

    const homepage = await getPublicHomepage();
    assert.notEqual(homepage.lead?.id, articles[0]?.contentItemId);
    assert.equal(new Set(allStoryIds(homepage)).size, allStoryIds(homepage).length);
  });

  it("does not expose unpublished assignments on the public homepage", async () => {
    const articles = await publishMany(3);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    await unpublishContent(
      articles[0]!.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const homepage = await getPublicHomepage();
    assert.notEqual(homepage.lead?.id, articles[0]?.contentItemId);
  });

  it("does not expose never-published assignments on publish", async () => {
    const draftOnly = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title: "Never published builder",
      body: articleBody("never-published-builder"),
    });
    const builder = await openBuilder();
    const state = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: draftOnly.contentItemId,
    });
    await assert.rejects(
      () =>
        publishHomepage({
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
          expectedUpdatedAt: state.updatedAt,
        }),
      (error: unknown) =>
        error instanceof HomepageBuilderError &&
        error.code === HOMEPAGE_BUILDER_ERROR.PUBLISH_VALIDATION_FAILED,
    );
  });

  it("does not expose scheduled replacement versions through homepage builder", async () => {
    const created = await publishApproved({
      title: "Builder scheduled live",
      body: articleBody("builder-scheduled-live"),
    });
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: created.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
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
      title: "Builder scheduled replacement",
      body: articleBody("builder-scheduled-replacement"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
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

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const story = homepage.lead;
    assert.equal(story?.id, created.contentItemId);
    assert.equal(story?.title, "Builder scheduled live");
    assert.notEqual(story?.title, "Builder scheduled replacement");
  });

  it("prefers editorial lead over recency fallback", async () => {
    const articles = await publishMany(4);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    const homepage = await getPublicHomepage();
    assert.equal(homepage.lead?.id, articles[0]?.contentItemId);
    assert.notEqual(homepage.lead?.id, articles[3]?.contentItemId);
  });

  it("respects editorial support ordering", async () => {
    const articles = await publishMany(5);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.SUPPORT_1,
      contentItemId: articles[1]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.SUPPORT_2,
      contentItemId: articles[0]?.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    const homepage = await getPublicHomepage();
    assert.deepEqual(
      homepage.supports.map((story) => story.id),
      [articles[1]?.contentItemId, articles[0]?.contentItemId],
    );
  });

  it("respects editorial featured ordering", async () => {
    const articles = await publishMany(8);
    let builder = await openBuilder();
    for (const [index, slotKey] of [
      HOMEPAGE_SLOT_KEY.FEATURED_1,
      HOMEPAGE_SLOT_KEY.FEATURED_2,
      HOMEPAGE_SLOT_KEY.FEATURED_3,
    ].entries()) {
      builder = await setHomepageSlot({
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
        expectedUpdatedAt: builder.updatedAt,
        slotKey,
        contentItemId: articles[index]?.contentItemId,
      });
    }
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    const homepage = await getPublicHomepage();
    assert.deepEqual(
      homepage.featured.slice(0, 3).map((story) => story.id),
      [
        articles[0]?.contentItemId,
        articles[1]?.contentItemId,
        articles[2]?.contentItemId,
      ],
    );
  });

  it("fills empty editorial slots with deterministic fallback", async () => {
    const articles = await publishMany(5);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[4]?.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    const homepage = await getPublicHomepage();
    assert.equal(homepage.lead?.id, articles[4]?.contentItemId);
    assert.ok(homepage.supports.length === 2);
    assert.ok(homepage.featured.length > 0);
    assert.equal(new Set(allStoryIds(homepage)).size, allStoryIds(homepage).length);
  });

  it("resolves editorial placements outside the recency candidate window", async () => {
    const articles = await publishMany(10);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    const homepage = await getPublicHomepage();
    assert.equal(homepage.lead?.id, articles[0]?.contentItemId);
    assert.equal(homepage.lead?.title, "Builder article 1");
  });

  it("avoids duplicate stories in the final public homepage", async () => {
    const articles = await publishMany(6);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[5]?.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    const homepage = await getPublicHomepage();
    const ids = allStoryIds(homepage);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("resolves public article fields from authoritative publishedVersionId", async () => {
    const created = await publishApproved({
      title: "Builder authoritative title",
      body: articleBody("builder-authoritative"),
      includeRelations: true,
    });
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: created.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(homepage.lead?.title, "Builder authoritative title");
    assert.equal(homepage.lead?.primaryCategory?.name, "Category A");
    assert.equal(
      homepage.lead?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
  });

  it("updates homepage presentation after article republish without editing builder", async () => {
    const created = await publishApproved({
      title: "Builder before republish",
      body: articleBody("builder-before-republish"),
    });
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: created.contentItemId,
    });
    await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
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
      title: "Builder after republish",
      body: articleBody("builder-after-republish"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
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
    await publishVersion(
      created.contentItemId,
      revision.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const homepage = await getPublicHomepage();
    assert.equal(homepage.lead?.title, "Builder after republish");
  });

  it("conflicts on stale homepage draft mutations", async () => {
    const articles = await publishMany(1);
    const builder = await openBuilder();
    await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });

    await assert.rejects(
      () =>
        setHomepageSlot({
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
          expectedUpdatedAt: builder.updatedAt,
          slotKey: HOMEPAGE_SLOT_KEY.SUPPORT_1,
          contentItemId: articles[0]?.contentItemId,
        }),
      (error: unknown) =>
        error instanceof HomepageBuilderError &&
        error.code === HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT,
    );
  });

  it("allows SUPER_ADMIN with HOMEPAGE_MANAGE to edit", async () => {
    const articles = await publishMany(1);
    const builder = await openBuilder();
    const state = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    assert.equal(
      state.draft.slots.find((slot) => slot.slotKey === HOMEPAGE_SLOT_KEY.LEAD)
        ?.contentItemId,
      articles[0]?.contentItemId,
    );
  });

  it("forbids editors without HOMEPAGE_MANAGE", async () => {
    const builder = await openBuilder();
    await assert.rejects(
      () =>
        setHomepageSlot({
          scope: selectedEditorScope([fixture.ids.categoryA]),
          actorId: fixture.ids.staffEditor,
          expectedUpdatedAt: builder.updatedAt,
          slotKey: HOMEPAGE_SLOT_KEY.LEAD,
          contentItemId: randomUUID(),
        }),
      (error: unknown) =>
        error instanceof HomepageBuilderError &&
        error.code === HOMEPAGE_BUILDER_ERROR.FORBIDDEN,
    );
  });

  it("requires HOMEPAGE_MANAGE to publish", async () => {
    const builder = await openBuilder();
    await assert.rejects(
      () =>
        publishHomepage({
          scope: selectedEditorScope([fixture.ids.categoryA]),
          actorId: fixture.ids.staffEditor,
          expectedUpdatedAt: builder.updatedAt,
        }),
      (error: unknown) =>
        error instanceof HomepageBuilderError &&
        error.code === HOMEPAGE_BUILDER_ERROR.FORBIDDEN,
    );
  });

  it("conflicts on stale concurrent publish", async () => {
    const articles = await publishMany(1);
    const builder = await openBuilder();
    const staleUpdatedAt = builder.updatedAt;
    await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });

    await assert.rejects(
      () =>
        publishHomepage({
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
          expectedUpdatedAt: staleUpdatedAt,
        }),
      (error: unknown) =>
        error instanceof HomepageBuilderError &&
        error.code === HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT,
    );
  });

  it("records homepage draft and publish audit events", async () => {
    const articles = await publishMany(1);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    builder = await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });
    await clearHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
    });

    const events = await getDb()
      .select({
        eventType: homepageAuditEvents.eventType,
      })
      .from(homepageAuditEvents);
    assert.equal(
      events.some(
        (event) => event.eventType === HOMEPAGE_AUDIT_EVENT_TYPE.HOMEPAGE_DRAFT_UPDATED,
      ),
      true,
    );
    assert.equal(
      events.some(
        (event) => event.eventType === HOMEPAGE_AUDIT_EVENT_TYPE.HOMEPAGE_PUBLISHED,
      ),
      true,
    );
  });

  it("allows draft assignments to non-published content but blocks publish", async () => {
    const draftOnly = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title: "Draft assignment allowed",
      body: articleBody("draft-assignment-allowed"),
    });
    const builder = await openBuilder();
    const state = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      contentItemId: draftOnly.contentItemId,
    });
    assert.equal(
      state.draft.slots.find((slot) => slot.slotKey === HOMEPAGE_SLOT_KEY.FEATURED_1)
        ?.contentItemId,
      draftOnly.contentItemId,
    );

    const publicHomepage = await getPublicHomepage();
    assert.notEqual(publicHomepage.featured[0]?.id, draftOnly.contentItemId);
  });

  it("swaps two populated Featured slots atomically without touching ATF slots", async () => {
    const articles = await publishMany(4);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.SUPPORT_1,
      contentItemId: articles[1]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      contentItemId: articles[2]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_2,
      contentItemId: articles[3]?.contentItemId,
    });

    const auditsBefore = await listDraftAuditEvents();
    const moved = await moveHomepageFeaturedSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      direction: "right",
    });

    assert.equal(slotContent(moved, HOMEPAGE_SLOT_KEY.FEATURED_1), articles[3]?.contentItemId);
    assert.equal(slotContent(moved, HOMEPAGE_SLOT_KEY.FEATURED_2), articles[2]?.contentItemId);
    assert.equal(slotContent(moved, HOMEPAGE_SLOT_KEY.LEAD), articles[0]?.contentItemId);
    assert.equal(slotContent(moved, HOMEPAGE_SLOT_KEY.SUPPORT_1), articles[1]?.contentItemId);
    assert.deepEqual(
      assertHomepageSlotAssignmentsUnique(moved.draft.slots),
      { ok: true, value: true },
    );

    const auditsAfter = await listDraftAuditEvents();
    assert.equal(auditsAfter.length, auditsBefore.length + 1);
    assert.equal(
      auditsAfter.some((event) => event.changeSet?.slots?.length === 2),
      true,
    );
  });

  it("moves Featured assignments into and out of an empty neighbor slot", async () => {
    const articles = await publishMany(1);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      contentItemId: articles[0]?.contentItemId,
    });

    const movedRight = await moveHomepageFeaturedSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      direction: "right",
    });
    assert.equal(slotContent(movedRight, HOMEPAGE_SLOT_KEY.FEATURED_1), null);
    assert.equal(
      slotContent(movedRight, HOMEPAGE_SLOT_KEY.FEATURED_2),
      articles[0]?.contentItemId,
    );

    const movedLeft = await moveHomepageFeaturedSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: movedRight.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_2,
      direction: "left",
    });
    assert.equal(
      slotContent(movedLeft, HOMEPAGE_SLOT_KEY.FEATURED_1),
      articles[0]?.contentItemId,
    );
    assert.equal(slotContent(movedLeft, HOMEPAGE_SLOT_KEY.FEATURED_2), null);
  });

  it("leaves both Featured slots unchanged on WRITE_CONFLICT", async () => {
    const articles = await publishMany(3);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      contentItemId: articles[0]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_2,
      contentItemId: articles[1]?.contentItemId,
    });
    const staleUpdatedAt = builder.updatedAt;
    await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[2]?.contentItemId,
    });

    const auditsBefore = await listDraftAuditEvents();
    await assert.rejects(
      () =>
        moveHomepageFeaturedSlot({
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
          expectedUpdatedAt: staleUpdatedAt,
          slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
          direction: "right",
        }),
      (error: unknown) =>
        error instanceof HomepageBuilderError &&
        error.code === HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT,
    );

    const after = await openBuilder();
    assert.equal(slotContent(after, HOMEPAGE_SLOT_KEY.FEATURED_1), articles[0]?.contentItemId);
    assert.equal(slotContent(after, HOMEPAGE_SLOT_KEY.FEATURED_2), articles[1]?.contentItemId);
    const auditsAfter = await listDraftAuditEvents();
    assert.equal(auditsAfter.length, auditsBefore.length);
  });

  it("does not expose a draft Featured reorder on the public homepage until publish", async () => {
    const articles = await publishMany(4);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articles[0]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      contentItemId: articles[2]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_2,
      contentItemId: articles[3]?.contentItemId,
    });
    builder = await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });

    const published = await getPublicHomepage();
    const publishedFeatured = published.featured.map((story) => story.id);

    await moveHomepageFeaturedSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      direction: "right",
    });

    const afterDraftMove = await getPublicHomepage();
    assert.deepEqual(
      afterDraftMove.featured.map((story) => story.id),
      publishedFeatured,
    );
    assert.equal(afterDraftMove.lead?.id, articles[0]?.contentItemId);
  });

  it("rejects Featured moves that are not adjacent Featured neighbors", async () => {
    const builder = await openBuilder();
    await assert.rejects(
      () =>
        moveHomepageFeaturedSlot({
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
          expectedUpdatedAt: builder.updatedAt,
          slotKey: HOMEPAGE_SLOT_KEY.LEAD,
          direction: "right",
        }),
      (error: unknown) =>
        error instanceof HomepageBuilderError &&
        error.code === HOMEPAGE_BUILDER_ERROR.INVALID_SLOT,
    );
    await assert.rejects(
      () =>
        moveHomepageFeaturedSlot({
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
          expectedUpdatedAt: builder.updatedAt,
          slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
          direction: "left",
        }),
      (error: unknown) =>
        error instanceof HomepageBuilderError &&
        error.code === HOMEPAGE_BUILDER_ERROR.INVALID_SLOT,
    );
  });

  it("rolls back both Featured slots when a later statement in the transaction fails", async () => {
    const articles = await publishMany(2);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      contentItemId: articles[0]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_2,
      contentItemId: articles[1]?.contentItemId,
    });

    await assert.rejects(() =>
      moveHomepageFeaturedSlot({
        scope: fixture.superAdmin,
        actorId: randomUUID(),
        expectedUpdatedAt: builder.updatedAt,
        slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
        direction: "right",
      }),
    );

    const after = await openBuilder();
    assert.equal(slotContent(after, HOMEPAGE_SLOT_KEY.FEATURED_1), articles[0]?.contentItemId);
    assert.equal(slotContent(after, HOMEPAGE_SLOT_KEY.FEATURED_2), articles[1]?.contentItemId);
  });

  it("blocks a competing Featured move until the homepage lock is released, then keeps both slots unchanged on conflict", async () => {
    const articles = await publishMany(2);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      contentItemId: articles[0]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_2,
      contentItemId: articles[1]?.contentItemId,
    });

    const holder = await getRacerPool().connect();
    try {
      await holder.query("BEGIN");
      await holder.query(
        "SELECT id FROM homepages WHERE id = $1 FOR UPDATE",
        [HOMEPAGE_CONFIG_ID],
      );
      const pidResult = await holder.query<{ pid: number }>(
        "SELECT pg_backend_pid() AS pid",
      );
      const holderPid = pidResult.rows[0]?.pid;
      assert.equal(typeof holderPid, "number");

      const competing = moveHomepageFeaturedSlot({
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
        expectedUpdatedAt: builder.updatedAt,
        slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
        direction: "right",
      });
      let competingSettled = false;
      const competingObserved = competing.then(
        (value) => {
          competingSettled = true;
          return value;
        },
        (error: unknown) => {
          competingSettled = true;
          throw error;
        },
      );

      await waitUntilBlockedByHolder(holderPid!);
      assert.equal(competingSettled, false);

      const nextUpdatedAt = nextMonotonicUpdatedAt(builder.updatedAt);
      await holder.query(
        "UPDATE homepages SET updated_at = $1 WHERE id = $2",
        [nextUpdatedAt, HOMEPAGE_CONFIG_ID],
      );
      await holder.query("COMMIT");

      await assert.rejects(competingObserved, (error: unknown) => {
        return (
          error instanceof HomepageBuilderError &&
          error.code === HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT
        );
      });

      const after = await openBuilder();
      assert.equal(
        slotContent(after, HOMEPAGE_SLOT_KEY.FEATURED_1),
        articles[0]?.contentItemId,
      );
      assert.equal(
        slotContent(after, HOMEPAGE_SLOT_KEY.FEATURED_2),
        articles[1]?.contentItemId,
      );
    } finally {
      try {
        await holder.query("ROLLBACK");
      } catch {
        // Transaction already committed or rolled back.
      }
      holder.release();
    }
  });

  it("lets only one concurrent Featured move commit a complete swap", async () => {
    const articles = await publishMany(2);
    let builder = await openBuilder();
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
      contentItemId: articles[0]?.contentItemId,
    });
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.FEATURED_2,
      contentItemId: articles[1]?.contentItemId,
    });

    const results = await Promise.allSettled([
      moveHomepageFeaturedSlot({
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
        expectedUpdatedAt: builder.updatedAt,
        slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
        direction: "right",
      }),
      moveHomepageFeaturedSlot({
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
        expectedUpdatedAt: builder.updatedAt,
        slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
        direction: "right",
      }),
    ]);
    const fulfilled = results.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof moveHomepageFeaturedSlot>>> =>
        result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(
      rejected[0]?.reason instanceof HomepageBuilderError &&
        rejected[0].reason.code === HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT,
      true,
    );

    const winner = fulfilled[0]?.value;
    assert.equal(slotContent(winner!, HOMEPAGE_SLOT_KEY.FEATURED_1), articles[1]?.contentItemId);
    assert.equal(slotContent(winner!, HOMEPAGE_SLOT_KEY.FEATURED_2), articles[0]?.contentItemId);

    const after = await openBuilder();
    assert.equal(slotContent(after, HOMEPAGE_SLOT_KEY.FEATURED_1), articles[1]?.contentItemId);
    assert.equal(slotContent(after, HOMEPAGE_SLOT_KEY.FEATURED_2), articles[0]?.contentItemId);
    assert.deepEqual(
      assertHomepageSlotAssignmentsUnique(after.draft.slots),
      { ok: true, value: true },
    );
  });
});
