import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { asc, eq } from "drizzle-orm";
import {
  AUTHOR_ROLE,
  ENTITY_ROLE,
  MEDIA_ROLE,
  PUBLICATION_STATUS,
  PUBLISHING_ERROR,
  PublishingError,
  WORKFLOW_STATUS,
} from "@magazine/domain";
import { getDb } from "../client";
import { getContentVersionDiff } from "../editor";
import {
  approveVersion,
  createDraftRevision,
  getContentItem,
  getContentVersion,
  publishVersion,
  submitForReview,
  updateDraftContent,
} from "../publishing";
import { contentReviewEvents } from "../schema/review-events";
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

function assertPublishingCode(error: unknown, code: string): void {
  assert.equal(error instanceof PublishingError, true, String(error));
  assert.equal((error as PublishingError).code, code);
}

async function listEvents(contentItemId: string) {
  const db = getDb();
  return db
    .select({
      id: contentReviewEvents.id,
      eventType: contentReviewEvents.eventType,
      actorId: contentReviewEvents.actorId,
      note: contentReviewEvents.note,
      contentVersionId: contentReviewEvents.contentVersionId,
      createdAt: contentReviewEvents.createdAt,
    })
    .from(contentReviewEvents)
    .where(eq(contentReviewEvents.contentItemId, contentItemId))
    .orderBy(asc(contentReviewEvents.createdAt), asc(contentReviewEvents.id));
}

describe("editorial semantic version diff PostgreSQL", () => {
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
  });

  after(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const leftoverTx = await countOpenTestTransactions();
    assert.equal(leftoverTx, 0, "integration tests leaked open transactions");
    await closeIntegrationConnections();
  });

  async function submitCurrent(
    contentItemId: string,
    versionId: string,
    expectedUpdatedAt: Date,
  ) {
    return submitForReview(contentItemId, versionId, {
      expectedUpdatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
  }

  async function approveCurrent(
    contentItemId: string,
    versionId: string,
    expectedUpdatedAt: Date,
  ) {
    return approveVersion(contentItemId, versionId, {
      expectedUpdatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
  }

  async function publishApproved(
    contentItemId: string,
    versionId: string,
    expectedUpdatedAt: Date,
  ) {
    const submitted = await submitCurrent(
      contentItemId,
      versionId,
      expectedUpdatedAt,
    );
    const approved = await approveCurrent(
      contentItemId,
      versionId,
      submitted.updatedAt,
    );
    await publishVersion(
      contentItemId,
      versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    return approved;
  }

  it("returns an authorized empty diff when a version is compared to itself", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Same title",
      body: articleBody("Same body"),
    });

    const diff = await getContentVersionDiff(
      created.contentItemId,
      created.versionId,
      created.versionId,
      fixture.superAdmin,
    );

    assert.equal(diff.contentItemId, created.contentItemId);
    assert.equal(diff.summary.changed, false);
    assert.equal(diff.fields.length, 0);
    assert.equal(diff.body.changed, false);
    assert.equal(diff.body.blocks.length, 0);
    assert.equal(diff.fromVersion.id, created.versionId);
    assert.equal(diff.toVersion.id, created.versionId);
    assert.equal(diff.fromVersion.isCurrentDraft, true);
    assert.equal(JSON.stringify(diff).includes('"fromBody"'), false);
  });

  it("masks inaccessible items and does not treat a version UUID as an item id", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
    });

    await assert.rejects(
      () =>
        getContentVersionDiff(
          created.contentItemId,
          created.versionId,
          created.versionId,
          fixture.selectedOnA,
        ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      },
    );

    await assert.rejects(
      () =>
        getContentVersionDiff(
          created.versionId,
          created.versionId,
          created.versionId,
          fixture.superAdmin,
        ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      },
    );
  });

  it("does not let known version UUIDs bypass ContentItem authorization", async () => {
    const hidden = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
      title: "Secret draft",
      body: articleBody("Unpublished secret"),
    });
    const visible = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
    });

    await assert.rejects(
      () =>
        getContentVersionDiff(
          hidden.contentItemId,
          hidden.versionId,
          hidden.versionId,
          fixture.selectedOnA,
        ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      },
    );

    await assert.rejects(
      () =>
        getContentVersionDiff(
          visible.contentItemId,
          hidden.versionId,
          hidden.versionId,
          fixture.selectedOnA,
        ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.VERSION_NOT_FOUND);
        return true;
      },
    );
  });

  it("rejects cross-item version comparison without leaking ownership", async () => {
    const itemA = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Item A",
    });
    const itemB = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Item B",
    });

    await assert.rejects(
      () =>
        getContentVersionDiff(
          itemA.contentItemId,
          itemA.versionId,
          itemB.versionId,
          fixture.superAdmin,
        ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.VERSION_NOT_FOUND);
        assert.equal(
          error instanceof PublishingError &&
            error.code === PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM,
          false,
        );
        return true;
      },
    );

    await assert.rejects(
      () =>
        getContentVersionDiff(
          itemA.contentItemId,
          itemB.versionId,
          itemB.versionId,
          fixture.superAdmin,
        ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.VERSION_NOT_FOUND);
        return true;
      },
    );

    await assert.rejects(
      () =>
        getContentVersionDiff(
          itemA.contentItemId,
          randomUUID(),
          itemA.versionId,
          fixture.superAdmin,
        ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.VERSION_NOT_FOUND);
        return true;
      },
    );
  });

  it("lets an authorized user compare historical unpublished versions", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Published A",
      body: articleBody("Published body"),
    });
    await publishApproved(
      created.contentItemId,
      created.versionId,
      created.updatedAt,
    );
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
      title: "Unpublished B",
      body: articleBody("Unpublished body"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
      tags: [{ tagId: fixture.ids.tag }],
      entities: [
        {
          entityId: fixture.ids.entity,
          role: ENTITY_ROLE.SUBJECT,
          sortOrder: 0,
        },
      ],
      media: [
        {
          mediaId: fixture.ids.media,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          caption: "cap",
          altText: "alt",
          credit: "cred",
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

    const diff = await getContentVersionDiff(
      created.contentItemId,
      created.versionId,
      revision.versionId,
      fixture.selectedOnA,
    );
    assert.equal(diff.summary.changed, true);
    assert.equal(diff.fromVersion.isPublishedVersion, true);
    assert.equal(diff.toVersion.isCurrentDraft, true);
    assert.equal(
      diff.fields.some(
        (field) => field.field === "title" && field.after === "Unpublished B",
      ),
      true,
    );

    await assert.rejects(
      () =>
        getContentVersionDiff(
          created.contentItemId,
          created.versionId,
          revision.versionId,
          fixture.selectedOnB,
        ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      },
    );
  });

  it("diffs real persisted scalars, body, and versioned relations", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Original title",
      body: articleBody("Hello world"),
    });
    const prepared = await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      title: "Original title",
      body: articleBody("Hello world"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
      tags: [{ tagId: fixture.ids.tag }],
      entities: [
        {
          entityId: fixture.ids.entity,
          role: ENTITY_ROLE.SUBJECT,
          sortOrder: 0,
        },
      ],
      media: [
        {
          mediaId: fixture.ids.media,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          caption: "cap",
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
        {
          authorId: fixture.ids.extraAuthor,
          role: AUTHOR_ROLE.AUTHOR,
          sortOrder: 1,
        },
      ],
    });
    await publishApproved(
      created.contentItemId,
      created.versionId,
      prepared.updatedAt,
    );
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
      title: "Revised title",
      seoTitle: "SEO revised",
      body: {
        blocks: [
          { type: "paragraph", text: "Hello brave world" },
          { type: "paragraph", text: "A later paragraph" },
        ],
      },
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [
        { categoryId: fixture.ids.categoryA, isPrimary: true },
        { categoryId: fixture.ids.categoryB, isPrimary: false },
      ],
      tags: [{ tagId: fixture.ids.extraTag }],
      entities: [
        {
          entityId: fixture.ids.entity,
          role: ENTITY_ROLE.MENTIONED,
          sortOrder: 0,
        },
      ],
      media: [
        {
          mediaId: fixture.ids.extraMedia,
          role: MEDIA_ROLE.GALLERY,
          sortOrder: 0,
          caption: "gallery",
          altText: "gallery-alt",
          credit: "gallery-cred",
        },
        {
          mediaId: fixture.ids.media,
          role: MEDIA_ROLE.HERO,
          sortOrder: 1,
          caption: "updated-cap",
          altText: "alt",
          credit: "cred",
        },
      ],
      authors: [
        {
          authorId: fixture.ids.extraAuthor,
          role: AUTHOR_ROLE.AUTHOR,
          sortOrder: 0,
        },
        {
          authorId: fixture.ids.author,
          role: AUTHOR_ROLE.CONTRIBUTOR,
          sortOrder: 1,
        },
      ],
    });

    const persistedFrom = await snapshotContent(
      created.contentItemId,
      created.versionId,
    );
    const persistedTo = await snapshotContent(
      created.contentItemId,
      revision.versionId,
    );
    assert.equal(persistedFrom.title, "Original title");
    assert.equal(persistedTo.title, "Revised title");

    const diff = await getContentVersionDiff(
      created.contentItemId,
      created.versionId,
      revision.versionId,
      fixture.superAdmin,
    );

    assert.equal(diff.summary.changed, true);
    assert.equal(
      diff.fields.some(
        (field) =>
          field.field === "title" &&
          field.before === persistedFrom.title &&
          field.after === persistedTo.title,
      ),
      true,
    );
    assert.equal(
      diff.fields.some(
        (field) => field.field === "seoTitle" && field.changeType === "ADDED",
      ),
      true,
    );

    const addedBlock = diff.body.blocks.find(
      (block) => block.changeType === "ADDED",
    );
    const modifiedBlock = diff.body.blocks.find(
      (block) => block.changeType === "MODIFIED",
    );
    assert.equal(Boolean(addedBlock), true);
    assert.equal(Boolean(modifiedBlock), true);
    assert.equal(
      diff.body.blocks.every((block) => block.changeType !== "REMOVED"),
      true,
    );
    assert.equal(diff.summary.blocksAdded, 1);
    assert.equal(diff.summary.blocksModified, 1);

    assert.equal(diff.relations.categories.primary.changed, false);
    assert.equal(
      diff.relations.categories.primary.after?.id,
      fixture.ids.categoryA,
    );
    assert.deepEqual(
      diff.relations.categories.added.map((item) => item.id),
      [fixture.ids.categoryB],
    );
    assert.deepEqual(
      diff.relations.tags.removed.map((item) => item.id),
      [fixture.ids.tag],
    );
    assert.deepEqual(
      diff.relations.tags.added.map((item) => item.id),
      [fixture.ids.extraTag],
    );
    assert.equal(diff.relations.entities.modified.length, 1);
    assert.equal(diff.relations.entities.modified[0]?.beforeRole, ENTITY_ROLE.SUBJECT);
    assert.equal(diff.relations.entities.modified[0]?.afterRole, ENTITY_ROLE.MENTIONED);
    assert.equal(diff.relations.media.reordered, true);
    assert.deepEqual(diff.relations.media.beforeOrder, [
      fixture.ids.media,
      fixture.ids.extraMedia,
    ]);
    assert.deepEqual(diff.relations.media.afterOrder, [
      fixture.ids.extraMedia,
      fixture.ids.media,
    ]);
    assert.equal(
      diff.relations.media.modified.some(
        (item) =>
          item.id === fixture.ids.media &&
          item.before.caption === "cap" &&
          item.after.caption === "updated-cap",
      ),
      true,
    );
    assert.equal(diff.relations.authors.reordered, true);
    assert.deepEqual(diff.relations.authors.beforeOrder, [
      fixture.ids.author,
      fixture.ids.extraAuthor,
    ]);
    assert.deepEqual(diff.relations.authors.afterOrder, [
      fixture.ids.extraAuthor,
      fixture.ids.author,
    ]);
    assert.equal(
      diff.relations.authors.modified.some(
        (item) =>
          item.id === fixture.ids.author &&
          item.beforeRole === AUTHOR_ROLE.AUTHOR &&
          item.afterRole === AUTHOR_ROLE.CONTRIBUTOR,
      ),
      true,
    );
    assert.equal(diff.summary.mediaChanged, true);
    assert.equal(diff.summary.authorsChanged, true);
  });

  it("is read-only against a published version and an IN_REVIEW successor", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Live A",
      body: articleBody("Live body"),
    });
    await publishApproved(
      created.contentItemId,
      created.versionId,
      created.updatedAt,
    );
    const revision = await createDraftRevision(
      created.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    const updated = await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      title: "Review B",
      body: articleBody("Review body"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
      tags: [{ tagId: fixture.ids.tag }],
      entities: [
        {
          entityId: fixture.ids.entity,
          role: ENTITY_ROLE.SUBJECT,
          sortOrder: 0,
        },
      ],
      media: [
        {
          mediaId: fixture.ids.media,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          caption: "cap",
          altText: "alt",
          credit: "cred",
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
    await submitCurrent(
      created.contentItemId,
      revision.versionId,
      updated.updatedAt,
    );

    const beforeItem = await getContentItem(created.contentItemId);
    const beforePublished = await getContentVersion(created.versionId);
    const beforeReview = await getContentVersion(revision.versionId);
    const beforeEvents = await listEvents(created.contentItemId);

    const diff = await getContentVersionDiff(
      created.contentItemId,
      created.versionId,
      revision.versionId,
      fixture.superAdmin,
    );

    assert.equal(diff.summary.changed, true);
    assert.equal(diff.fromVersion.isPublishedVersion, true);
    assert.equal(diff.toVersion.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
    assert.equal(diff.toVersion.isCurrentDraft, true);

    const afterItem = await getContentItem(created.contentItemId);
    const afterPublished = await getContentVersion(created.versionId);
    const afterReview = await getContentVersion(revision.versionId);
    const afterEvents = await listEvents(created.contentItemId);

    assert.equal(afterItem.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(afterItem.publishedVersionId, created.versionId);
    assert.equal(afterItem.draftVersionId, revision.versionId);
    assert.equal(afterItem.scheduledVersionId, beforeItem.scheduledVersionId);
    assert.equal(afterItem.scheduleGeneration, beforeItem.scheduleGeneration);
    assert.equal(afterPublished.workflowStatus, beforePublished.workflowStatus);
    assert.equal(afterReview.workflowStatus, beforeReview.workflowStatus);
    assert.equal(afterReview.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
    assert.equal(afterReview.title, "Review B");
    assert.deepEqual(
      afterEvents.map((event) => event.id),
      beforeEvents.map((event) => event.id),
    );
    assert.equal(beforeEvents.length > 0, true);
  });
});
