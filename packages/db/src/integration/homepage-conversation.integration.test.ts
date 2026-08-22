import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  CONVERSATION_ERROR,
  ConversationError,
  MEDIA_ROLE,
  PUBLICATION_STATUS,
  WORKFLOW_STATUS,
} from "@magazine/domain";
import { eq } from "drizzle-orm";
import { getDb } from "../client";
import {
  createHomepageConversationItem,
  deleteHomepageConversationItem,
  listHomepageConversationItems,
  reorderHomepageConversationItems,
  updateHomepageConversationItem,
} from "../editor";
import { getPublicHomepage } from "../public";
import {
  approveVersion,
  createDraftRevision,
  getContentItem,
  publishVersion,
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

describe("homepage conversation PostgreSQL", () => {
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

  function assertNoInternalLeak(value: object): void {
    const publicValue = { ...value } as Record<string, unknown>;
    // Pass 3 public instrumentation IDs, not editorial internals.
    delete publicValue.analyticsPlacements;
    delete publicValue.homepageVersionId;
    delete publicValue.homepageViewContext;
    delete publicValue.homepageVideoContext;
    const serialized = JSON.stringify(publicValue);
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
    assert.equal(serialized.includes("isActive"), false);
    assert.equal(serialized.includes("sortOrder"), false);
    assert.equal(serialized.includes("contentItemId"), false);
    assert.equal(serialized.includes("expectedUpdatedAt"), false);
    assert.equal(serialized.includes("engagement"), false);
    assert.equal(serialized.includes("trending"), false);
  }

  async function rejectUnauthorized(
    action: () => Promise<unknown>,
  ): Promise<void> {
    await assert.rejects(action, (error: unknown) => {
      assert.equal(error instanceof ConversationError, true);
      if (error instanceof ConversationError) {
        assert.equal(error.code, CONVERSATION_ERROR.FORBIDDEN);
      }
      return true;
    });
  }

  it("returns ranked conversation items in deterministic 1-5 order", async () => {
    const first = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Topic A",
      reason: "First placed",
    });
    const second = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Topic B",
    });
    const third = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Topic C",
    });
    await reorderHomepageConversationItems({
      scope: fixture.superAdmin,
      expectedUpdatedAt: (await listHomepageConversationItems(fixture.superAdmin)).reduce(
        (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
        new Date(0),
      ),
      orderedIds: [third.id, first.id, second.id],
    });

    const homepage = await getPublicHomepage();
    assert.deepEqual(
      homepage.conversation.map((item) => ({
        rank: item.rank,
        label: item.label,
      })),
      [
        { rank: 1, label: "Topic C" },
        { rank: 2, label: "Topic A" },
        { rank: 3, label: "Topic B" },
      ],
    );
    assert.equal(homepage.conversation.every((item) => item.article === null), true);
    assertNoInternalLeak(homepage);
  });

  it("enforces the public 5 item limit at write time", async () => {
    for (const label of ["One", "Two", "Three", "Four", "Five"]) {
      await createHomepageConversationItem({
        scope: fixture.superAdmin,
        label,
      });
    }

    await assert.rejects(
      () =>
        createHomepageConversationItem({
          scope: fixture.superAdmin,
          label: "Six",
        }),
      (error: unknown) => {
        assert.equal(error instanceof ConversationError, true);
        if (error instanceof ConversationError) {
          assert.equal(error.code, CONVERSATION_ERROR.LIMIT_EXCEEDED);
        }
        return true;
      },
    );

    const homepage = await getPublicHomepage();
    assert.equal(homepage.conversation.length, 5);
    assert.deepEqual(
      homepage.conversation.map((item) => item.label),
      ["One", "Two", "Three", "Four", "Five"],
    );
    assert.deepEqual(
      homepage.conversation.map((item) => item.rank),
      [1, 2, 3, 4, 5],
    );
  });

  it("omits inactive conversation items from the public rail", async () => {
    const live = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Live topic",
    });
    const hidden = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Hidden topic",
    });
    await updateHomepageConversationItem({
      scope: fixture.superAdmin,
      id: hidden.id,
      expectedUpdatedAt: hidden.updatedAt,
      isActive: false,
    });

    const listed = await listHomepageConversationItems(fixture.superAdmin);
    assert.equal(listed.some((item) => item.id === hidden.id && !item.isActive), true);

    const homepage = await getPublicHomepage();
    assert.deepEqual(
      homepage.conversation.map((item) => item.label),
      ["Live topic"],
    );
    assert.equal(homepage.conversation[0]?.rank, 1);
    assert.equal(
      JSON.stringify(homepage).includes("Hidden topic"),
      false,
    );
    assert.equal(listed[0]?.id, live.id);
  });

  it("attaches a currently PUBLISHED article and its published HERO", async () => {
    const published = await publishApproved({
      title: "Published conversation article",
      body: articleBody("published-conversation-article"),
    });
    await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Hande Erçel",
      reason: "Dizi finali konuşuluyor",
      contentItemId: published.contentItemId,
    });

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(homepage.conversation.length, 1);
    assert.equal(homepage.conversation[0]?.label, "Hande Erçel");
    assert.equal(homepage.conversation[0]?.reason, "Dizi finali konuşuluyor");
    assert.equal(homepage.conversation[0]?.article?.id, published.contentItemId);
    assert.equal(homepage.conversation[0]?.article?.slug, published.slug);
    assert.equal(
      homepage.conversation[0]?.article?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
    assert.equal(homepage.conversation[0]?.article?.hero?.altText, "alt");
    assert.equal(
      JSON.stringify(homepage.conversation).includes("Published conversation article"),
      false,
    );
    assertNoInternalLeak(homepage);
  });

  it("does not leak a draft-only linked article", async () => {
    const draft = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Draft conversation title must not leak",
      body: articleBody("draft-conversation-body-must-not-leak"),
    });
    const item = await getContentItem(draft.contentItemId);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.NEVER_PUBLISHED);

    await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Editorial only topic",
      contentItemId: draft.contentItemId,
    });

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const serialized = JSON.stringify(homepage);
    assert.equal(homepage.conversation[0]?.article, null);
    assert.equal(serialized.includes("Draft conversation title must not leak"), false);
    assert.equal(serialized.includes(draft.slug), false);
    assert.equal(serialized.includes("draft-conversation-body-must-not-leak"), false);
    assertNoInternalLeak(homepage);
  });

  it("does not expose unpublished linked article data", async () => {
    const published = await publishApproved({
      title: "Withdrawn conversation article",
      body: articleBody("withdrawn-conversation-body"),
    });
    await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Withdrawn topic",
      contentItemId: published.contentItemId,
    });
    await unpublishContent(
      published.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    const item = await getContentItem(published.contentItemId);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(item.publishedVersionId, published.versionId);

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const serialized = JSON.stringify(homepage);
    assert.equal(homepage.conversation[0]?.article, null);
    assert.equal(serialized.includes("Withdrawn conversation article"), false);
    assert.equal(serialized.includes(published.slug), false);
    assert.equal(serialized.includes("withdrawn-conversation-body"), false);
    assertNoInternalLeak(homepage);
  });

  it("does not expose deleted linked content", async () => {
    const published = await publishApproved({
      title: "Deleted conversation article",
      body: articleBody("deleted-conversation-body"),
    });
    await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Deleted topic",
      contentItemId: published.contentItemId,
    });
    await getDb()
      .update(contentItems)
      .set({ deletedAt: new Date() })
      .where(eq(contentItems.id, published.contentItemId));

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const serialized = JSON.stringify(homepage);
    assert.equal(homepage.conversation[0]?.article, null);
    assert.equal(serialized.includes("Deleted conversation article"), false);
    assert.equal(serialized.includes(published.slug), false);
    assertNoInternalLeak(homepage);
  });

  it("does not leak a draft HERO through a conversation item", async () => {
    const published = await publishApproved({
      title: "Live conversation photo",
      body: articleBody("live-conversation-photo"),
    });
    await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Photo topic",
      contentItemId: published.contentItemId,
    });
    const revision = await createDraftRevision(
      published.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    await updateDraftContent({
      contentItemId: published.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      title: "Draft conversation photo title must not leak",
      body: articleBody("draft-conversation-photo-body"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      media: [
        {
          mediaId: fixture.ids.extraMedia,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          altText: "draft conversation alt must not leak",
          credit: "draft conversation credit must not leak",
        },
      ],
    });

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const article = homepage.conversation[0]?.article;
    assert.equal(article?.id, published.contentItemId);
    assert.equal(
      article?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
    assert.equal(article?.hero?.altText, "alt");
    const serialized = JSON.stringify(homepage);
    assert.equal(serialized.includes("draft conversation alt must not leak"), false);
    assert.equal(serialized.includes(fixture.ids.extraMedia), false);
    assert.equal(serialized.includes("Draft conversation photo title must not leak"), false);

    const draft = await snapshotContent(published.contentItemId, revision.versionId);
    assert.equal(draft.workflowStatus, WORKFLOW_STATUS.DRAFT);
    assert.equal(draft.media[0]?.mediaId, fixture.ids.extraMedia);
    assertNoInternalLeak(homepage);
  });

  it("keeps reorder deterministic after compaction", async () => {
    const a = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Alpha",
    });
    const b = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Beta",
    });
    const c = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Gamma",
    });
    await deleteHomepageConversationItem({
      scope: fixture.superAdmin,
      id: b.id,
      expectedUpdatedAt: b.updatedAt,
    });
    const remaining = await listHomepageConversationItems(fixture.superAdmin);
    assert.deepEqual(
      remaining.map((item) => ({ sortOrder: item.sortOrder, label: item.label })),
      [
        { sortOrder: 1, label: "Alpha" },
        { sortOrder: 2, label: "Gamma" },
      ],
    );

    await reorderHomepageConversationItems({
      scope: fixture.superAdmin,
      expectedUpdatedAt: remaining.reduce(
        (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
        new Date(0),
      ),
      orderedIds: [c.id, a.id],
    });
    const homepage = await getPublicHomepage();
    assert.deepEqual(
      homepage.conversation.map((item) => ({ rank: item.rank, label: item.label })),
      [
        { rank: 1, label: "Gamma" },
        { rank: 2, label: "Alpha" },
      ],
    );
  });

  it("fails closed for a malformed content relation and invalid editor writes", async () => {
    await assert.rejects(
      () =>
        createHomepageConversationItem({
          scope: fixture.superAdmin,
          label: "Bad link",
          contentItemId: "not-a-uuid",
        }),
      (error: unknown) => {
        assert.equal(error instanceof ConversationError, true);
        if (error instanceof ConversationError) {
          assert.equal(error.code, CONVERSATION_ERROR.INVALID_CONTENT_ITEM);
        }
        return true;
      },
    );

    await assert.rejects(
      () =>
        createHomepageConversationItem({
          scope: fixture.superAdmin,
          label: "Missing link",
          contentItemId: "00000000-0000-4000-8000-000000000000",
        }),
      (error: unknown) => {
        assert.equal(error instanceof ConversationError, true);
        if (error instanceof ConversationError) {
          assert.equal(error.code, CONVERSATION_ERROR.INVALID_CONTENT_ITEM);
        }
        return true;
      },
    );

    const listed = await listHomepageConversationItems(fixture.superAdmin);
    assert.equal(listed.length, 0);
    assert.deepEqual((await getPublicHomepage()).conversation, []);
  });

  it("rejects duplicate linked content and stale reorder tokens", async () => {
    const published = await publishApproved({
      title: "Duplicate conversation article",
      body: articleBody("duplicate-conversation-article"),
    });
    const first = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "First duplicate",
      contentItemId: published.contentItemId,
    });
    const second = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Second item",
    });
    const staleUpdatedAt = (await listHomepageConversationItems(fixture.superAdmin)).reduce(
      (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
      new Date(0),
    );

    await assert.rejects(
      () =>
        createHomepageConversationItem({
          scope: fixture.superAdmin,
          label: "Duplicate article",
          contentItemId: published.contentItemId,
        }),
      (error: unknown) => {
        assert.equal(error instanceof ConversationError, true);
        if (error instanceof ConversationError) {
          assert.equal(error.code, CONVERSATION_ERROR.DUPLICATE_CONTENT_ITEM);
        }
        return true;
      },
    );

    const updated = await updateHomepageConversationItem({
      scope: fixture.superAdmin,
      id: second.id,
      expectedUpdatedAt: second.updatedAt,
      label: "Second item updated",
    });

    await assert.rejects(
      () =>
        reorderHomepageConversationItems({
          scope: fixture.superAdmin,
          expectedUpdatedAt: staleUpdatedAt,
          orderedIds: [updated.id, first.id],
        }),
      (error: unknown) => {
        assert.equal(error instanceof ConversationError, true);
        if (error instanceof ConversationError) {
          assert.equal(error.code, CONVERSATION_ERROR.WRITE_CONFLICT);
        }
        return true;
      },
    );

    const listed = await listHomepageConversationItems(fixture.superAdmin);
    assert.deepEqual(
      listed.map((item) => item.label),
      ["First duplicate", "Second item updated"],
    );
    assert.deepEqual(
      (await getPublicHomepage()).conversation.map((item) => item.label),
      ["First duplicate", "Second item updated"],
    );
  });

  it("removes only the conversation placement and leaves the linked article published", async () => {
    const published = await publishApproved({
      title: "Placement-only conversation article",
      body: articleBody("placement-only-conversation-article"),
    });
    const created = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Placement topic",
      contentItemId: published.contentItemId,
    });

    await deleteHomepageConversationItem({
      scope: fixture.superAdmin,
      id: created.id,
      expectedUpdatedAt: created.updatedAt,
    });

    assert.deepEqual(await listHomepageConversationItems(fixture.superAdmin), []);
    assert.deepEqual((await getPublicHomepage()).conversation, []);

    const item = await getContentItem(published.contentItemId);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(item.publishedVersionId, published.versionId);
    assert.equal(item.deletedAt, null);
  });

  it("rejects editor conversation writes without HOMEPAGE_MANAGE", async () => {
    await rejectUnauthorized(() =>
      listHomepageConversationItems(fixture.selectedOnA),
    );
    await rejectUnauthorized(() =>
      createHomepageConversationItem({
        scope: fixture.selectedOnA,
        label: "Unauthorized topic",
      }),
    );

    const created = await createHomepageConversationItem({
      scope: fixture.superAdmin,
      label: "Managed topic",
    });

    await rejectUnauthorized(() =>
      updateHomepageConversationItem({
        scope: fixture.selectedOnA,
        id: created.id,
        expectedUpdatedAt: created.updatedAt,
        label: "Hijacked",
      }),
    );
    await rejectUnauthorized(() =>
      reorderHomepageConversationItems({
        scope: fixture.selectedOnA,
        expectedUpdatedAt: created.updatedAt,
        orderedIds: [created.id],
      }),
    );
    await rejectUnauthorized(() =>
      deleteHomepageConversationItem({
        scope: fixture.selectedOnA,
        id: created.id,
        expectedUpdatedAt: created.updatedAt,
      }),
    );

    const listed = await listHomepageConversationItems(fixture.superAdmin);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.label, "Managed topic");
  });
});
