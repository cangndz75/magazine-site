import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  PUBLICATION_STATUS,
  PUBLISHING_ERROR,
  PublishingError,
  SCHEDULED_PUBLISH_DECISION,
  WORKFLOW_STATUS,
  nextMonotonicUpdatedAt,
} from "@magazine/domain";
import {
  approveVersion,
  createDraftRevision,
  executeScheduledPublish,
  publishVersion,
  rescheduleVersion,
  scheduleVersion,
  submitForReview,
  unpublishContent,
  unscheduleVersion,
  updateDraftContent,
  updateDraftScalarFields,
} from "../publishing";
import {
  clearPublishingTestHooks,
  setPublishingTestHooks,
} from "../publishing/test-hooks";
import {
  BODIES,
  articleBody,
  cleanupFixture,
  closeIntegrationConnections,
  countLeftoverFixtures,
  countOpenTestTransactions,
  createDraftItem,
  createFixture,
  deferred,
  ensureEditorContentTestDatabase,
  getRacerPool,
  persistUpdatedAtMs,
  primaryA,
  primaryASecondaryB,
  replaceVersionCategoriesDirect,
  requiredTimestampMs,
  snapshotContent,
  waitUntilBlockedByHolder,
  type IntegrationFixture,
} from "./harness";

function assertPublishingCode(error: unknown, code: string): void {
  assert.equal(error instanceof PublishingError, true, String(error));
  assert.equal((error as PublishingError).code, code);
}

async function assertUnchanged(
  contentItemId: string,
  versionId: string,
  expected: Awaited<ReturnType<typeof snapshotContent>>,
): Promise<void> {
  const actual = await snapshotContent(contentItemId, versionId);
  assert.deepEqual(actual, expected);
}

describe("editor content PostgreSQL integration", () => {
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

  describe("optimistic stale save", () => {
    it("rejects a stale draft save and keeps the winning write", async () => {
      const created = await createDraftItem(fixture, { includeRelations: true });
      const t1 = created.updatedAt;
      const before = await snapshotContent(created.contentItemId, created.versionId);

      const saved = await updateDraftContent({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt: t1,
        title: "Actor A title",
        body: BODIES.actorA,
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffEditor,
        categories: primaryA(fixture),
        tags: [{ tagId: fixture.ids.extraTag }],
        entities: [],
        media: [],
        authors: [],
      });

      const t2 = saved.updatedAt;
      assert.equal(requiredTimestampMs(t2) > requiredTimestampMs(t1), true);

      await assert.rejects(
        () =>
          updateDraftContent({
            contentItemId: created.contentItemId,
            versionId: created.versionId,
            expectedUpdatedAt: t1,
            title: "Actor B title",
            body: BODIES.actorB,
            scope: fixture.selectedOnA,
            actorId: fixture.ids.staffEditor,
            categories: primaryA(fixture),
            tags: [{ tagId: fixture.ids.tag }],
            entities: [],
            media: [],
            authors: [],
          }),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
          return true;
        },
      );

      const after = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(after.title, "Actor A title");
      assert.deepEqual(after.body, BODIES.actorA);
      assert.deepEqual(after.tags, [{ tagId: fixture.ids.extraTag }]);
      assert.equal(after.updatedAtMs, requiredTimestampMs(t2));
      assert.equal(after.updatedAtMs === before.updatedAtMs, false);
    });
  });

  describe("updatedAt round-trip", () => {
    it("persists the same monotonic token the service returns", async () => {
      const created = await createDraftItem(fixture);
      const previous = requiredTimestampMs(created.updatedAt);

      const saved = await updateDraftContent({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt: created.updatedAt,
        title: "Round trip title",
        body: articleBody("round-trip"),
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffEditor,
        categories: primaryA(fixture),
      });

      const returned = requiredTimestampMs(saved.updatedAt);
      const persisted = await persistUpdatedAtMs(created.contentItemId);

      assert.equal(returned > previous, true);
      assert.equal(persisted > previous, true);
      assert.equal(persisted, returned);
    });
  });

  describe("scalar draft save", () => {
    it("updates only draft scalar fields and leaves the published source intact", async () => {
      const created = await createDraftItem(fixture, { includeRelations: true });
      const submitted = await submitForReview(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: created.updatedAt,
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
        },
      );
      await approveVersion(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: submitted.updatedAt,
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffReviewerA,
        },
      );
      await publishVersion(
        created.contentItemId,
        created.versionId,
        fixture.selectedOnA,
        fixture.ids.staffReviewerA,
      );

      const publishedBefore = await snapshotContent(
        created.contentItemId,
        created.versionId,
      );
      const revision = await createDraftRevision(
        created.contentItemId,
        undefined,
        fixture.selectedOnA,
        fixture.ids.staffEditor,
      );
      const draftBefore = await snapshotContent(
        created.contentItemId,
        revision.versionId,
      );

      const saved = await updateDraftScalarFields({
        contentItemId: created.contentItemId,
        versionId: revision.versionId,
        expectedUpdatedAt: revision.updatedAt,
        title: "Scalar-only draft title",
        subtitle: "Scalar subtitle",
        excerpt: "Scalar excerpt",
        seoTitle: "Scalar SEO title",
        seoDescription: "Scalar SEO description",
        canonicalUrl: "https://example.test/scalar-only",
        robots: "index,follow",
        credibility: "CONFIRMED",
        credibilitySource: "Desk check",
        source: "Wire",
        sourceOrganization: "Example News",
        sourceUrl: "https://example.test/source",
        syndicated: true,
        isMaterialUpdate: true,
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffEditor,
      });

      const publishedAfter = await snapshotContent(
        created.contentItemId,
        created.versionId,
      );
      const draftAfter = await snapshotContent(
        created.contentItemId,
        revision.versionId,
      );

      assert.equal(requiredTimestampMs(saved.updatedAt) > draftBefore.updatedAtMs, true);
      assert.equal(
        publishedAfter.publicationStatus,
        publishedBefore.publicationStatus,
      );
      assert.equal(
        publishedAfter.publishedVersionId,
        publishedBefore.publishedVersionId,
      );
      assert.equal(
        publishedAfter.scheduledVersionId,
        publishedBefore.scheduledVersionId,
      );
      assert.equal(
        publishedAfter.scheduledAtMs,
        publishedBefore.scheduledAtMs,
      );
      assert.equal(
        publishedAfter.scheduleGeneration,
        publishedBefore.scheduleGeneration,
      );
      assert.equal(publishedAfter.title, publishedBefore.title);
      assert.deepEqual(publishedAfter.body, publishedBefore.body);
      assert.equal(
        publishedAfter.workflowStatus,
        publishedBefore.workflowStatus,
      );
      assert.deepEqual(
        publishedAfter.categories,
        publishedBefore.categories,
      );
      assert.deepEqual(publishedAfter.tags, publishedBefore.tags);
      assert.deepEqual(
        publishedAfter.entities,
        publishedBefore.entities,
      );
      assert.deepEqual(publishedAfter.media, publishedBefore.media);
      assert.deepEqual(
        publishedAfter.authors,
        publishedBefore.authors,
      );
      assert.equal(publishedAfter.publishedVersionId, created.versionId);
      assert.equal(publishedAfter.draftVersionId, revision.versionId);
      assert.equal(draftAfter.title, "Scalar-only draft title");
      assert.deepEqual(draftAfter.body, draftBefore.body);
      assert.deepEqual(draftAfter.categories, draftBefore.categories);
      assert.deepEqual(draftAfter.tags, draftBefore.tags);
      assert.deepEqual(draftAfter.entities, draftBefore.entities);
      assert.deepEqual(draftAfter.media, draftBefore.media);
      assert.deepEqual(draftAfter.authors, draftBefore.authors);
      assert.equal(draftAfter.workflowStatus, WORKFLOW_STATUS.DRAFT);
      assert.equal(draftAfter.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
      assert.equal(draftAfter.publishedVersionId, created.versionId);
      assert.equal(draftAfter.draftVersionId, revision.versionId);
      assert.equal(draftAfter.scheduledVersionId, null);
    });

    it("persists body edits through the article editor save path without touching the published version", async () => {
      const created = await createDraftItem(fixture, {
        body: articleBody("published body"),
      });
      const submitted = await submitForReview(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: created.updatedAt,
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
        },
      );
      await approveVersion(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: submitted.updatedAt,
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffReviewerA,
        },
      );
      await publishVersion(
        created.contentItemId,
        created.versionId,
        fixture.selectedOnA,
        fixture.ids.staffReviewerA,
      );

      const publishedBefore = await snapshotContent(
        created.contentItemId,
        created.versionId,
      );
      const revision = await createDraftRevision(
        created.contentItemId,
        undefined,
        fixture.selectedOnA,
        fixture.ids.staffEditor,
      );
      const draftBefore = await snapshotContent(
        created.contentItemId,
        revision.versionId,
      );
      const nextBody = {
        blocks: [
          { type: "heading", level: 2, text: "Yeni ara başlık" },
          { type: "paragraph", text: "Türkçe gövde paragrafı" },
        ],
      };

      const saved = await updateDraftScalarFields({
        contentItemId: created.contentItemId,
        versionId: revision.versionId,
        expectedUpdatedAt: revision.updatedAt,
        title: draftBefore.title,
        body: nextBody,
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffEditor,
      });

      const draftAfter = await snapshotContent(
        created.contentItemId,
        revision.versionId,
      );
      const publishedAfter = await snapshotContent(
        created.contentItemId,
        created.versionId,
      );

      assert.deepEqual(draftAfter.body, nextBody);
      assert.equal(draftAfter.workflowStatus, WORKFLOW_STATUS.DRAFT);
      assert.equal(draftAfter.publishedVersionId, created.versionId);
      assert.deepEqual(publishedAfter.body, publishedBefore.body);

      await assert.rejects(
        () =>
          updateDraftScalarFields({
            contentItemId: created.contentItemId,
            versionId: revision.versionId,
            expectedUpdatedAt: revision.updatedAt,
            title: draftBefore.title,
            body: articleBody("stale body"),
            scope: fixture.selectedOnA,
            actorId: fixture.ids.staffEditor,
          }),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
          return true;
        },
      );
      const afterConflict = await snapshotContent(
        created.contentItemId,
        revision.versionId,
      );
      assert.deepEqual(afterConflict.body, nextBody);

      const audit = await getRacerPool().query<{
        event_type: string;
        change_set: {
          bodyChange?: { changed?: boolean; detailLimited?: boolean };
          scalarChanges?: unknown[];
        } | null;
      }>(
        `SELECT event_type, change_set
         FROM content_audit_events
         WHERE content_item_id = $1 AND content_version_id = $2
         ORDER BY occurred_at DESC, id DESC
         LIMIT 1`,
        [created.contentItemId, revision.versionId],
      );
      assert.equal(audit.rows[0]?.event_type, "DRAFT_UPDATED");
      assert.equal(audit.rows[0]?.change_set?.bodyChange?.changed, true);
      assert.equal(
        audit.rows[0]?.change_set?.bodyChange?.detailLimited,
        true,
      );
      assert.equal(audit.rows[0]?.change_set?.scalarChanges, undefined);
      assert.equal(requiredTimestampMs(saved.updatedAt) > draftBefore.updatedAtMs, true);
    });
  });

  describe("FOR UPDATE serialization", () => {
    it("blocks a competing mutation until the holder commits, then re-evaluates the new token", async () => {
      const created = await createDraftItem(fixture);
      const t1 = created.updatedAt;
      const original = await snapshotContent(created.contentItemId, created.versionId);

      const holder = await getRacerPool().connect();
      try {
        await holder.query("BEGIN");
        await holder.query(
          "SELECT id FROM content_items WHERE id = $1 FOR UPDATE",
          [created.contentItemId],
        );
        const pidResult = await holder.query<{ pid: number }>(
          "SELECT pg_backend_pid() AS pid",
        );
        const holderPid = pidResult.rows[0]?.pid;
        assert.equal(typeof holderPid, "number");

        const competing = updateDraftContent({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: t1,
          title: "Should not commit",
          body: BODIES.actorB,
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          categories: primaryA(fixture),
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

        const t2 = nextMonotonicUpdatedAt(t1);
        await holder.query(
          "UPDATE content_items SET updated_at = $1 WHERE id = $2",
          [t2, created.contentItemId],
        );
        await holder.query("COMMIT");

        await assert.rejects(competingObserved, (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
          return true;
        });

        const after = await snapshotContent(
          created.contentItemId,
          created.versionId,
        );
        assert.equal(after.title, original.title);
        assert.deepEqual(after.body, original.body);
        assert.deepEqual(after.categories, original.categories);
        assert.equal(after.updatedAtMs, requiredTimestampMs(t2));
      } finally {
        try {
          await holder.query("ROLLBACK");
        } catch {
          // Transaction already committed or rolled back.
        }
        holder.release();
      }
    });
  });

  describe("category TOCTOU", () => {
    it("rejects a SELECTED mutation after locked categories move out of scope", async () => {
      const created = await createDraftItem(fixture, { includeRelations: true });
      const before = await snapshotContent(created.contentItemId, created.versionId);

      const locked = deferred();
      const resume = deferred();
      setPublishingTestHooks({
        afterContentItemLocked: async ({ contentItemId }) => {
          if (contentItemId !== created.contentItemId) {
            return;
          }
          locked.resolve();
          await resume.promise;
        },
      });

      const mutation = updateDraftContent({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt: created.updatedAt,
        title: "Should not commit",
        body: BODIES.actorB,
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffEditor,
        categories: primaryA(fixture),
        tags: [{ tagId: fixture.ids.extraTag }],
      });

      await locked.promise;
      await replaceVersionCategoriesDirect(
        created.versionId,
        fixture.ids.categoryB,
      );
      resume.resolve();

      await assert.rejects(mutation, (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      });

      const after = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(after.title, before.title);
      assert.deepEqual(after.body, before.body);
      assert.deepEqual(after.tags, before.tags);
      assert.equal(after.updatedAtMs, before.updatedAtMs);
      assert.deepEqual(after.categories, [
        { categoryId: fixture.ids.categoryB, isPrimary: true },
      ]);
    });
  });

  describe("submit-review", () => {
    it("rejects a stale submit-review then accepts the current token", async () => {
      const created = await createDraftItem(fixture);
      const t1 = created.updatedAt;

      const saved = await updateDraftContent({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt: t1,
        title: "Ready for review",
        body: articleBody("review"),
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffEditor,
        categories: primaryA(fixture),
      });
      const t2 = saved.updatedAt;

      await assert.rejects(
        () =>
          submitForReview(created.contentItemId, created.versionId, {
            expectedUpdatedAt: t1,
            scope: fixture.selectedOnA,
            actorId: fixture.ids.staffEditor,
          }),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
          return true;
        },
      );

      const stale = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(stale.workflowStatus, WORKFLOW_STATUS.DRAFT);
      assert.equal(stale.updatedAtMs, requiredTimestampMs(t2));

      const submitted = await submitForReview(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: t2,
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
        },
      );

      assert.equal(submitted.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
      const persisted = await persistUpdatedAtMs(created.contentItemId);
      assert.equal(persisted, requiredTimestampMs(submitted.updatedAt));
      assert.equal(persisted > requiredTimestampMs(t2), true);

      const after = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(after.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
    });
  });

  describe("SELECTED scope", () => {
    it("rejects an empty primary payload without mutating relations or updatedAt", async () => {
      const created = await createDraftItem(fixture, { includeRelations: true });
      const before = await snapshotContent(created.contentItemId, created.versionId);

      await assert.rejects(
        () =>
          updateDraftContent({
            contentItemId: created.contentItemId,
            versionId: created.versionId,
            expectedUpdatedAt: created.updatedAt,
            title: "Empty categories",
            body: BODIES.actorB,
            scope: fixture.selectedOnA,
            actorId: fixture.ids.staffEditor,
            categories: [],
            tags: [],
            entities: [],
            media: [],
            authors: [],
          }),
        (error: unknown) => {
          assertPublishingCode(
            error,
            PUBLISHING_ERROR.SELECTED_SCOPE_PRIMARY_REQUIRED,
          );
          return true;
        },
      );

      await assertUnchanged(created.contentItemId, created.versionId, before);

      const saved = await updateDraftContent({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt: created.updatedAt,
        title: "Valid selected save",
        body: articleBody("selected-ok"),
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffEditor,
        categories: primaryA(fixture),
        tags: [{ tagId: fixture.ids.tag }],
        entities: [],
        media: [],
        authors: [],
      });

      const after = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(after.title, "Valid selected save");
      assert.deepEqual(after.categories, primaryA(fixture));
      assert.equal(after.updatedAtMs, requiredTimestampMs(saved.updatedAt));
    });
  });

  describe("unauthorized secondary rollback", () => {
    it("rolls back content and all relations when a secondary category is out of scope", async () => {
      const created = await createDraftItem(fixture, { includeRelations: true });
      const before = await snapshotContent(created.contentItemId, created.versionId);

      await assert.rejects(
        () =>
          updateDraftContent({
            contentItemId: created.contentItemId,
            versionId: created.versionId,
            expectedUpdatedAt: created.updatedAt,
            title: "Smuggled secondary",
            body: BODIES.actorB,
            scope: fixture.selectedOnA,
            actorId: fixture.ids.staffEditor,
            categories: primaryASecondaryB(fixture),
            tags: [{ tagId: fixture.ids.extraTag }],
            entities: [],
            media: [],
            authors: [],
          }),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CATEGORY_OUT_OF_SCOPE);
          return true;
        },
      );

      await assertUnchanged(created.contentItemId, created.versionId, before);
    });
  });

  describe("relation atomicity", () => {
    it("rolls back content and relations when a write fails after replacement starts", async () => {
      const created = await createDraftItem(fixture, { includeRelations: true });
      const before = await snapshotContent(created.contentItemId, created.versionId);

      setPublishingTestHooks({
        afterVersionRelationsReplaced: async ({ contentVersionId }) => {
          if (contentVersionId !== created.versionId) {
            return;
          }
          throw new Error("INTEGRATION_FORCED_ROLLBACK");
        },
      });

      await assert.rejects(
        () =>
          updateDraftContent({
            contentItemId: created.contentItemId,
            versionId: created.versionId,
            expectedUpdatedAt: created.updatedAt,
            title: "Partial write",
            body: BODIES.actorB,
            scope: fixture.selectedOnA,
            actorId: fixture.ids.staffEditor,
            categories: primaryA(fixture),
            tags: [{ tagId: fixture.ids.extraTag }],
            entities: [],
            media: [],
            authors: [],
          }),
        (error: unknown) => {
          assert.equal(error instanceof Error, true);
          assert.equal((error as Error).message, "INTEGRATION_FORCED_ROLLBACK");
          return true;
        },
      );

      await assertUnchanged(created.contentItemId, created.versionId, before);
    });
  });

  describe("lifecycle authorization races", () => {
    async function approveDraft() {
      const created = await createDraftItem(fixture);
      const submitted = await submitForReview(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: created.updatedAt,
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
        },
      );
      const approved = await approveVersion(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: submitted.updatedAt,
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffReviewerA,
        },
      );
      return { created, submitted, approved };
    }

    it("rejects publish after the locked target version leaves SELECTED scope", async () => {
      const { created } = await approveDraft();
      const before = await snapshotContent(created.contentItemId, created.versionId);

      const locked = deferred();
      const resume = deferred();
      setPublishingTestHooks({
        afterContentItemLocked: async ({ contentItemId }) => {
          if (contentItemId !== created.contentItemId) {
            return;
          }
          locked.resolve();
          await resume.promise;
        },
      });

      const mutation = publishVersion(
        created.contentItemId,
        created.versionId,
        fixture.selectedOnA,
        fixture.ids.staffReviewerA,
      );

      await locked.promise;
      await replaceVersionCategoriesDirect(
        created.versionId,
        fixture.ids.categoryB,
      );
      resume.resolve();

      await assert.rejects(mutation, (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      });

      const after = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(after.publicationStatus, before.publicationStatus);
      assert.equal(after.publishedVersionId, null);
      assert.equal(after.updatedAtMs, before.updatedAtMs);
    });

    it("rejects unpublish after the locked published version leaves SELECTED scope", async () => {
      const { created } = await approveDraft();
      await publishVersion(
        created.contentItemId,
        created.versionId,
        fixture.selectedOnA,
        fixture.ids.staffReviewerA,
      );
      const before = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(before.publishedVersionId, created.versionId);

      const locked = deferred();
      const resume = deferred();
      setPublishingTestHooks({
        afterContentItemLocked: async ({ contentItemId }) => {
          if (contentItemId !== created.contentItemId) {
            return;
          }
          locked.resolve();
          await resume.promise;
        },
      });

      const mutation = unpublishContent(
        created.contentItemId,
        fixture.selectedOnA,
        fixture.ids.staffReviewerA,
      );

      await locked.promise;
      await replaceVersionCategoriesDirect(
        created.versionId,
        fixture.ids.categoryB,
      );
      resume.resolve();

      await assert.rejects(mutation, (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      });

      const after = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(after.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
      assert.equal(after.publishedVersionId, created.versionId);
      assert.equal(after.updatedAtMs, before.updatedAtMs);
    });

    it("rejects reschedule after the locked scheduled version leaves SELECTED scope", async () => {
      const { created } = await approveDraft();
      const now = new Date();
      const firstAt = new Date(now.getTime() + 60_000);
      const secondAt = new Date(now.getTime() + 120_000);

      await scheduleVersion(
        created.contentItemId,
        created.versionId,
        firstAt,
        fixture.selectedOnA,
        fixture.ids.staffReviewerA,
        now,
      );
      const before = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(before.scheduledVersionId, created.versionId);

      const locked = deferred();
      const resume = deferred();
      setPublishingTestHooks({
        afterContentItemLocked: async ({ contentItemId }) => {
          if (contentItemId !== created.contentItemId) {
            return;
          }
          locked.resolve();
          await resume.promise;
        },
      });

      const mutation = rescheduleVersion(
        created.contentItemId,
        secondAt,
        fixture.selectedOnA,
        fixture.ids.staffReviewerA,
        now,
      );

      await locked.promise;
      await replaceVersionCategoriesDirect(
        created.versionId,
        fixture.ids.categoryB,
      );
      resume.resolve();

      await assert.rejects(mutation, (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      });

      const after = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(after.scheduledVersionId, created.versionId);
      assert.equal(after.scheduledAtMs, before.scheduledAtMs);
      assert.equal(after.scheduleGeneration, before.scheduleGeneration);
      assert.equal(after.updatedAtMs, before.updatedAtMs);
    });

    it("rejects unschedule after the locked scheduled version leaves SELECTED scope", async () => {
      const { created } = await approveDraft();
      const now = new Date();
      await scheduleVersion(
        created.contentItemId,
        created.versionId,
        new Date(now.getTime() + 60_000),
        fixture.selectedOnA,
        fixture.ids.staffReviewerA,
        now,
      );
      const before = await snapshotContent(created.contentItemId, created.versionId);

      const locked = deferred();
      const resume = deferred();
      setPublishingTestHooks({
        afterContentItemLocked: async ({ contentItemId }) => {
          if (contentItemId !== created.contentItemId) {
            return;
          }
          locked.resolve();
          await resume.promise;
        },
      });

      const mutation = unscheduleVersion(
        created.contentItemId,
        fixture.selectedOnA,
        fixture.ids.staffReviewerA,
      );

      await locked.promise;
      await replaceVersionCategoriesDirect(
        created.versionId,
        fixture.ids.categoryB,
      );
      resume.resolve();

      await assert.rejects(mutation, (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      });

      const after = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(after.scheduledVersionId, created.versionId);
      assert.equal(after.scheduleGeneration, before.scheduleGeneration);
      assert.equal(after.updatedAtMs, before.updatedAtMs);
    });
  });

  describe("scheduled publish worker", () => {
    it("executes without editor staff scope and keeps updatedAt monotonic", async () => {
      const created = await createDraftItem(fixture);
      const submitted = await submitForReview(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: created.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
        },
      );
      await approveVersion(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: submitted.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffReviewerA,
        },
      );

      const now = new Date();
      const scheduledAt = new Date(now.getTime() + 60_000);
      const scheduled = await scheduleVersion(
        created.contentItemId,
        created.versionId,
        scheduledAt,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
        now,
      );

      const beforeMs = await persistUpdatedAtMs(created.contentItemId);
      const executed = await executeScheduledPublish(
        created.contentItemId,
        scheduled.scheduleGeneration,
        scheduledAt,
      );

      assert.equal(executed.outcome, SCHEDULED_PUBLISH_DECISION.EXECUTE);
      if (executed.outcome !== SCHEDULED_PUBLISH_DECISION.EXECUTE) {
        return;
      }

      const item = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(item.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
      assert.equal(item.publishedVersionId, created.versionId);
      assert.equal(item.scheduledVersionId, null);
      assert.equal(item.updatedAtMs > beforeMs, true);
      assert.equal(item.updatedAtMs > requiredTimestampMs(submitted.updatedAt), true);
    });
  });
});
