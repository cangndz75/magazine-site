import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  AUTHOR_ROLE,
  ENTITY_ROLE,
  MEDIA_ROLE,
  PUBLICATION_STATUS,
  PUBLISHING_ERROR,
  PublishingError,
  WORKFLOW_STATUS,
} from "@magazine/domain";
import {
  approveVersion,
  createDraftRevision,
  publishVersion,
  submitForReview,
  updateDraftContent,
} from "../publishing";
import { getDb } from "../client";
import { contentVersionTags } from "../schema/content";
import { eq } from "drizzle-orm";
import {
  articleBody,
  cleanupFixture,
  closeIntegrationConnections,
  countLeftoverFixtures,
  countOpenTestTransactions,
  createDraftItem,
  createFixture,
  ensureEditorContentTestDatabase,
  primaryA,
  primaryASecondaryB,
  snapshotContent,
  requiredTimestampMs,
  type IntegrationFixture,
} from "./harness";

function sortedCategories(
  categories: { categoryId: string; isPrimary: boolean }[],
) {
  return [...categories].sort((a, b) => a.categoryId.localeCompare(b.categoryId));
}

function assertPublishingCode(error: unknown, code: string): void {
  assert.equal(error instanceof PublishingError, true, String(error));
  assert.equal((error as PublishingError).code, code);
}

function baseRelations(fixture: IntegrationFixture) {
  return {
    categories: primaryA(fixture),
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
  };
}

async function publishThenDraft(fixture: IntegrationFixture) {
  const created = await createDraftItem(fixture, {
    scope: fixture.superAdmin,
    includeRelations: true,
    title: "Published source",
  });
  const submitted = await submitForReview(created.contentItemId, created.versionId, {
    expectedUpdatedAt: created.updatedAt,
    scope: fixture.superAdmin,
    actorId: fixture.ids.staffEditor,
  });
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
  const revision = await createDraftRevision(
    created.contentItemId,
    undefined,
    fixture.superAdmin,
    fixture.ids.staffEditor,
  );
  return { created, revision };
}

describe("version-owned editorial relation editing", () => {
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

  it("clones published relations into V2 then isolates later V2 edits from V1", async () => {
    const { created, revision } = await publishThenDraft(fixture);
    const v1Before = await snapshotContent(created.contentItemId, created.versionId);
    const v2Before = await snapshotContent(created.contentItemId, revision.versionId);

    assert.deepEqual(v2Before.categories, v1Before.categories);
    assert.deepEqual(v2Before.tags, v1Before.tags);
    assert.deepEqual(v2Before.authors, v1Before.authors);
    assert.deepEqual(v2Before.entities, v1Before.entities);
    assert.deepEqual(v2Before.media, v1Before.media);

    const saved = await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      title: "Draft metadata edit",
      body: articleBody("v2-relations"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      ...baseRelations(fixture),
      categories: primaryASecondaryB(fixture),
      tags: [{ tagId: fixture.ids.extraTag }],
      authors: [
        {
          authorId: fixture.ids.extraAuthor,
          role: AUTHOR_ROLE.AUTHOR,
          sortOrder: 0,
        },
      ],
      media: [
        {
          mediaId: fixture.ids.extraMedia,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          caption: "new-cap",
          altText: "new-alt",
          credit: "new-cred",
        },
      ],
      entities: [],
    });

    const v1After = await snapshotContent(created.contentItemId, created.versionId);
    const v2After = await snapshotContent(created.contentItemId, revision.versionId);

    assert.deepEqual(v1After.categories, v1Before.categories);
    assert.deepEqual(v1After.tags, v1Before.tags);
    assert.deepEqual(v1After.authors, v1Before.authors);
    assert.deepEqual(v1After.entities, v1Before.entities);
    assert.deepEqual(v1After.media, v1Before.media);
    assert.equal(v1After.title, v1Before.title);
    assert.equal(v1After.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(v1After.publishedVersionId, created.versionId);
    assert.equal(v1After.draftVersionId, revision.versionId);

    assert.deepEqual(v2After.categories, sortedCategories(primaryASecondaryB(fixture)));
    assert.deepEqual(v2After.tags, [{ tagId: fixture.ids.extraTag }]);
    assert.equal(v2After.authors[0]?.authorId, fixture.ids.extraAuthor);
    assert.deepEqual(v2After.entities, []);
    assert.equal(v2After.media[0]?.mediaId, fixture.ids.extraMedia);
    assert.equal(v2After.media[0]?.caption, "new-cap");
    assert.equal(v2After.title, "Draft metadata edit");
    assert.equal(v2After.updatedAtMs > v2Before.updatedAtMs, true);
    assert.equal(v2After.updatedAtMs, requiredTimestampMs(saved.updatedAt));
  });

  it("updates V2 primary category monotonically without mutating V1", async () => {
    const { created, revision } = await publishThenDraft(fixture);
    const v1Before = await snapshotContent(created.contentItemId, created.versionId);

    const saved = await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      title: v1Before.title,
      body: articleBody("v2-primary"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      ...baseRelations(fixture),
      categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
    });

    const v1After = await snapshotContent(created.contentItemId, created.versionId);
    const v2After = await snapshotContent(created.contentItemId, revision.versionId);
    assert.deepEqual(v1After.categories, v1Before.categories);
    assert.deepEqual(v2After.categories, [
      { categoryId: fixture.ids.categoryB, isPrimary: true },
    ]);
    assert.equal(v2After.updatedAtMs > v1Before.updatedAtMs, true);
    assert.equal(v2After.updatedAtMs, requiredTimestampMs(saved.updatedAt));
  });

  it("adds and removes secondary categories as an exact set", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
    });
    const added = await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      title: "Original title",
      body: articleBody("secondary-add"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      ...baseRelations(fixture),
      categories: primaryASecondaryB(fixture),
    });
    const afterAdd = await snapshotContent(created.contentItemId, created.versionId);
    assert.deepEqual(afterAdd.categories, sortedCategories(primaryASecondaryB(fixture)));

    await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: added.updatedAt,
      title: "Original title",
      body: articleBody("secondary-remove"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      ...baseRelations(fixture),
      categories: primaryA(fixture),
    });
    const afterRemove = await snapshotContent(created.contentItemId, created.versionId);
    assert.deepEqual(afterRemove.categories, primaryA(fixture));
  });

  it("changes the byline on the draft version only", async () => {
    const { created, revision } = await publishThenDraft(fixture);
    await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      title: "Published source",
      body: articleBody("author-change"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      ...baseRelations(fixture),
      authors: [
        {
          authorId: fixture.ids.extraAuthor,
          role: AUTHOR_ROLE.AUTHOR,
          sortOrder: 0,
        },
      ],
    });
    const v1 = await snapshotContent(created.contentItemId, created.versionId);
    const v2 = await snapshotContent(created.contentItemId, revision.versionId);
    assert.equal(v1.authors[0]?.authorId, fixture.ids.author);
    assert.equal(v2.authors[0]?.authorId, fixture.ids.extraAuthor);
  });

  it("adds and removes tags without duplicate join rows", async () => {
    const created = await createDraftItem(fixture, { includeRelations: true });
    const before = await snapshotContent(created.contentItemId, created.versionId);

    await assert.rejects(
      () =>
        updateDraftContent({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          title: "dup",
          body: articleBody("dup-tags"),
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          ...baseRelations(fixture),
          tags: [{ tagId: fixture.ids.tag }, { tagId: fixture.ids.tag }],
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.DUPLICATE_RELATION);
        return true;
      },
    );
    const unchanged = await snapshotContent(created.contentItemId, created.versionId);
    assert.deepEqual(unchanged.tags, before.tags);
    assert.equal(unchanged.updatedAtMs, before.updatedAtMs);

    await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      title: "Original title",
      body: articleBody("tags"),
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      ...baseRelations(fixture),
      tags: [{ tagId: fixture.ids.tag }, { tagId: fixture.ids.extraTag }],
    });

    const db = getDb();
    const rows = await db
      .select({ tagId: contentVersionTags.tagId })
      .from(contentVersionTags)
      .where(eq(contentVersionTags.contentVersionId, created.versionId));
    assert.equal(rows.length, 2);
    assert.deepEqual(
      [...rows.map((row) => row.tagId)].sort(),
      [fixture.ids.extraTag, fixture.ids.tag].sort(),
    );
  });

  it("rejects an unknown entity id and leaves the draft unchanged", async () => {
    const created = await createDraftItem(fixture, { includeRelations: true });
    const before = await snapshotContent(created.contentItemId, created.versionId);
    await assert.rejects(
      () =>
        updateDraftContent({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          title: "Should not persist",
          body: articleBody("bad-entity"),
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          ...baseRelations(fixture),
          entities: [
            {
              entityId: randomUUID(),
              role: ENTITY_ROLE.SUBJECT,
              sortOrder: 0,
            },
          ],
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.RELATION_NOT_FOUND);
        return true;
      },
    );
    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.deepEqual(after, before);
  });

  it("rolls back scalar changes when a relation write is invalid", async () => {
    const created = await createDraftItem(fixture, { includeRelations: true });
    const before = await snapshotContent(created.contentItemId, created.versionId);
    await assert.rejects(
      () =>
        updateDraftContent({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          title: "Partial scalar",
          body: articleBody("partial"),
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          ...baseRelations(fixture),
          tags: [{ tagId: randomUUID() }],
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.RELATION_NOT_FOUND);
        return true;
      },
    );
    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(after.title, before.title);
    assert.deepEqual(after.body, before.body);
    assert.deepEqual(after.tags, before.tags);
    assert.equal(after.updatedAtMs, before.updatedAtMs);
  });

  it("rejects a stale token and keeps the first relation write", async () => {
    const created = await createDraftItem(fixture, { includeRelations: true });
    const first = await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      title: "Actor A",
      body: articleBody("actor-a"),
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      ...baseRelations(fixture),
      tags: [{ tagId: fixture.ids.tag }, { tagId: fixture.ids.extraTag }],
    });

    await assert.rejects(
      () =>
        updateDraftContent({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          title: "Actor B",
          body: articleBody("actor-b"),
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          ...baseRelations(fixture),
          categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
          tags: [{ tagId: fixture.ids.tag }],
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
        return true;
      },
    );

    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(after.title, "Actor A");
    assert.deepEqual(
      after.tags.map((item) => item.tagId).sort(),
      [fixture.ids.extraTag, fixture.ids.tag].sort(),
    );
    assert.equal(after.updatedAtMs, requiredTimestampMs(first.updatedAt));
  });

  it("rejects an unauthorized primary-category move and keeps original relations", async () => {
    const created = await createDraftItem(fixture, { includeRelations: true });
    const before = await snapshotContent(created.contentItemId, created.versionId);
    await assert.rejects(
      () =>
        updateDraftContent({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          title: "Moved",
          body: articleBody("moved"),
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          ...baseRelations(fixture),
          categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CATEGORY_OUT_OF_SCOPE);
        return true;
      },
    );
    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.deepEqual(after, before);
  });

  it("carries edited draft relations through submit, approve, and publish", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
    });
    const saved = await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      title: "Ready to publish",
      body: articleBody("ready"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      ...baseRelations(fixture),
      categories: primaryASecondaryB(fixture),
      tags: [{ tagId: fixture.ids.extraTag }],
      authors: [
        {
          authorId: fixture.ids.extraAuthor,
          role: AUTHOR_ROLE.AUTHOR,
          sortOrder: 0,
        },
      ],
    });
    const submitted = await submitForReview(created.contentItemId, created.versionId, {
      expectedUpdatedAt: saved.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    const approved = await approveVersion(created.contentItemId, created.versionId, {
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

    const published = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(published.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(published.workflowStatus, WORKFLOW_STATUS.APPROVED);
    assert.deepEqual(published.categories, sortedCategories(primaryASecondaryB(fixture)));
    assert.deepEqual(published.tags, [{ tagId: fixture.ids.extraTag }]);
    assert.equal(published.authors[0]?.authorId, fixture.ids.extraAuthor);
    assert.equal(approved.versionId, created.versionId);
  });
});
