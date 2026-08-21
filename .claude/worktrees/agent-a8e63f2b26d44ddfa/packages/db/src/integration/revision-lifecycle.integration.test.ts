import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  PUBLICATION_STATUS,
  PUBLISHING_ERROR,
  PublishingError,
  SCHEDULED_PUBLISH_DECISION,
  WORKFLOW_STATUS,
} from "@magazine/domain";
import {
  getArticleEditorModel,
  listContentRevisionHistory,
  listReviewQueue,
} from "../editor";
import { getDb } from "../client";
import {
  approveVersion,
  createDraftRevision,
  executeScheduledPublish,
  publishVersion,
  scheduleVersion,
  submitForReview,
  unscheduleVersion,
  updateDraftContent,
} from "../publishing";
import { contentVersions } from "../schema/content";
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
  snapshotContent,
  type IntegrationFixture,
} from "./harness";

function assertPublishingCode(error: unknown, code: string): void {
  assert.equal(error instanceof PublishingError, true, String(error));
  assert.equal((error as PublishingError).code, code);
}

describe("post-publish revision lifecycle PostgreSQL", () => {
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

  async function publishApprovedDraft() {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
    });
    const submitted = await submitForReview(created.contentItemId, created.versionId, {
      expectedUpdatedAt: created.updatedAt,
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
    return { created, approved };
  }

  async function countVersions(contentItemId: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .select({ id: contentVersions.id })
      .from(contentVersions)
      .where(eq(contentVersions.contentItemId, contentItemId));
    return rows.length;
  }

  describe("createDraftRevision", () => {
    it("clones the published version into a new DRAFT without mutating the live article", async () => {
      const { created } = await publishApprovedDraft();
      const liveBefore = await snapshotContent(created.contentItemId, created.versionId);

      const revision = await createDraftRevision(
        created.contentItemId,
        undefined,
        fixture.superAdmin,
        fixture.ids.staffEditor,
      );

      assert.equal(revision.sourceVersionId, created.versionId);
      assert.notEqual(revision.versionId, created.versionId);
      assert.equal(revision.draftVersionId, revision.versionId);

      const liveAfter = await snapshotContent(created.contentItemId, created.versionId);
      const draft = await snapshotContent(created.contentItemId, revision.versionId);

      assert.equal(liveAfter.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
      assert.equal(liveAfter.publishedVersionId, created.versionId);
      assert.equal(liveAfter.draftVersionId, revision.versionId);
      assert.equal(liveAfter.workflowStatus, WORKFLOW_STATUS.APPROVED);
      assert.deepEqual(liveAfter.body, liveBefore.body);
      assert.equal(liveAfter.title, liveBefore.title);
      assert.deepEqual(liveAfter.categories, liveBefore.categories);
      assert.deepEqual(liveAfter.tags, liveBefore.tags);
      assert.deepEqual(liveAfter.authors, liveBefore.authors);
      assert.deepEqual(liveAfter.media, liveBefore.media);
      assert.deepEqual(liveAfter.entities, liveBefore.entities);

      assert.equal(draft.workflowStatus, WORKFLOW_STATUS.DRAFT);
      assert.equal(draft.title, liveBefore.title);
      assert.deepEqual(draft.body, liveBefore.body);
      assert.deepEqual(draft.categories, liveBefore.categories);
      assert.deepEqual(draft.tags, liveBefore.tags);
      assert.deepEqual(draft.authors, liveBefore.authors);
      assert.deepEqual(draft.media, liveBefore.media);
      assert.deepEqual(draft.entities, liveBefore.entities);

      const history = await listContentRevisionHistory(
        created.contentItemId,
        fixture.superAdmin,
        { limit: 10 },
      );
      assert.equal(history.versions[0]?.id, revision.versionId);
      assert.equal(history.versions[0]?.workflowStatus, WORKFLOW_STATUS.DRAFT);
      assert.equal(history.versions[0]?.isCurrentDraft, true);
      assert.equal(history.versions[0]?.isPublishedVersion, false);
      assert.equal(history.publishedVersionId, created.versionId);
    });

    it("rejects a second active draft and concurrent creators", async () => {
      const { created } = await publishApprovedDraft();
      const first = await createDraftRevision(
        created.contentItemId,
        undefined,
        fixture.superAdmin,
        fixture.ids.staffEditor,
      );

      await assert.rejects(
        () =>
          createDraftRevision(
            created.contentItemId,
            undefined,
            fixture.superAdmin,
            fixture.ids.staffEditor,
          ),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.DRAFT_ALREADY_EXISTS);
          return true;
        },
      );

      assert.equal(await countVersions(created.contentItemId), 2);
      const after = await snapshotContent(created.contentItemId, first.versionId);
      assert.equal(after.draftVersionId, first.versionId);
      assert.equal(after.publishedVersionId, created.versionId);
    });

    it("serializes two concurrent createDraftRevision calls to a single active draft", async () => {
      const { created } = await publishApprovedDraft();
      const results = await Promise.allSettled([
        createDraftRevision(
          created.contentItemId,
          undefined,
          fixture.superAdmin,
          fixture.ids.staffEditor,
        ),
        createDraftRevision(
          created.contentItemId,
          undefined,
          fixture.superAdmin,
          fixture.ids.staffReviewerA,
        ),
      ]);

      const fulfilled = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const rejected = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assertPublishingCode(rejected[0], PUBLISHING_ERROR.DRAFT_ALREADY_EXISTS);

      assert.equal(await countVersions(created.contentItemId), 2);
      const item = await snapshotContent(
        created.contentItemId,
        fulfilled[0]!.versionId,
      );
      assert.equal(item.draftVersionId, fulfilled[0]!.versionId);
      assert.equal(item.publishedVersionId, created.versionId);
    });

    it("rejects out-of-scope revision creation without creating a draft", async () => {
      const { created } = await publishApprovedDraft();
      await assert.rejects(
        () =>
          createDraftRevision(
            created.contentItemId,
            undefined,
            fixture.selectedOnB,
            fixture.ids.staffEditor,
          ),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
          return true;
        },
      );
      const after = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(after.draftVersionId, null);
      assert.equal(after.publishedVersionId, created.versionId);
      assert.equal(await countVersions(created.contentItemId), 1);
    });
  });

  describe("unschedule recovery", () => {
    it("restores a never-published scheduled version as the recoverable draft pointer", async () => {
      const created = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        includeRelations: true,
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
      const now = new Date();
      const scheduled = await scheduleVersion(
        created.contentItemId,
        created.versionId,
        new Date(now.getTime() + 60_000),
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
        now,
      );
      assert.equal(scheduled.draftVersionId, null);
      const generation = scheduled.scheduleGeneration;

      const unscheduled = await unscheduleVersion(
        created.contentItemId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      );
      assert.equal(unscheduled.draftVersionId, created.versionId);
      assert.equal(unscheduled.scheduledVersionId, null);
      assert.equal(unscheduled.scheduleGeneration, generation + 1);

      const recovered = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(recovered.publicationStatus, PUBLICATION_STATUS.NEVER_PUBLISHED);
      assert.equal(recovered.publishedVersionId, null);
      assert.equal(recovered.scheduledVersionId, null);
      assert.equal(recovered.draftVersionId, created.versionId);
      assert.equal(recovered.workflowStatus, WORKFLOW_STATUS.APPROVED);

      const model = await getArticleEditorModel(created.contentItemId);
      assert.equal(model?.editableVersion?.id, created.versionId);
      assert.equal(model?.editableVersion?.workflowStatus, WORKFLOW_STATUS.APPROVED);
      assert.equal(model?.editableVersion?.canEdit, false);

      const stale = await executeScheduledPublish(
        created.contentItemId,
        generation,
        new Date(now.getTime() + 120_000),
      );
      assert.equal(stale.outcome, SCHEDULED_PUBLISH_DECISION.NOOP_STALE);
      const afterStale = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(afterStale.publicationStatus, PUBLICATION_STATUS.NEVER_PUBLISHED);
      assert.equal(afterStale.publishedVersionId, null);
    });

    it("keeps the published version public when unscheduling a replacement", async () => {
      const { created } = await publishApprovedDraft();
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
        title: "Replacement",
        body: articleBody("replacement"),
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

      const unscheduled = await unscheduleVersion(
        created.contentItemId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      );
      assert.equal(unscheduled.draftVersionId, revision.versionId);

      const live = await snapshotContent(created.contentItemId, created.versionId);
      const recovered = await snapshotContent(created.contentItemId, revision.versionId);
      assert.equal(live.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
      assert.equal(live.publishedVersionId, created.versionId);
      assert.equal(live.workflowStatus, WORKFLOW_STATUS.APPROVED);
      assert.equal(recovered.draftVersionId, revision.versionId);
      assert.equal(recovered.scheduledVersionId, null);
      assert.equal(recovered.workflowStatus, WORKFLOW_STATUS.APPROVED);
      assert.equal(recovered.title, "Replacement");
    });

    it("does not overwrite a separate draft when unscheduling", async () => {
      const created = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        includeRelations: true,
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
      const now = new Date();
      await scheduleVersion(
        created.contentItemId,
        created.versionId,
        new Date(now.getTime() + 60_000),
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
        now,
      );
      const parallel = await createDraftRevision(
        created.contentItemId,
        created.versionId,
        fixture.superAdmin,
        fixture.ids.staffEditor,
      );

      const unscheduled = await unscheduleVersion(
        created.contentItemId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      );
      assert.equal(unscheduled.draftVersionId, parallel.versionId);

      const after = await snapshotContent(created.contentItemId, parallel.versionId);
      assert.equal(after.draftVersionId, parallel.versionId);
      assert.equal(after.scheduledVersionId, null);
      assert.equal(after.workflowStatus, WORKFLOW_STATUS.DRAFT);
      const scheduledSource = await snapshotContent(
        created.contentItemId,
        created.versionId,
      );
      assert.equal(scheduledSource.workflowStatus, WORKFLOW_STATUS.APPROVED);
    });
  });

  describe("end-to-end editorial lifecycle", () => {
    it("publishes V1, drafts V2, schedules, unschedules, then worker-publishes the rescheduled version", async () => {
      const created = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        includeRelations: true,
        title: "Lifecycle v1",
      });
      let token = created.updatedAt;
      const savedV1 = await updateDraftContent({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt: token,
        title: "Lifecycle v1 saved",
        body: articleBody("v1 body"),
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
        categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
      });
      token = savedV1.updatedAt;
      const submittedV1 = await submitForReview(created.contentItemId, created.versionId, {
        expectedUpdatedAt: token,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      });
      token = submittedV1.updatedAt;
      const approvedV1 = await approveVersion(created.contentItemId, created.versionId, {
        expectedUpdatedAt: token,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffReviewerA,
      });
      token = approvedV1.updatedAt;
      await publishVersion(
        created.contentItemId,
        created.versionId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      );

      const v2 = await createDraftRevision(
        created.contentItemId,
        undefined,
        fixture.superAdmin,
        fixture.ids.staffEditor,
      );
      const savedV2 = await updateDraftContent({
        contentItemId: created.contentItemId,
        versionId: v2.versionId,
        expectedUpdatedAt: v2.updatedAt,
        title: "Lifecycle v2",
        body: articleBody("v2 body"),
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
        categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
      });
      const submittedV2 = await submitForReview(created.contentItemId, v2.versionId, {
        expectedUpdatedAt: savedV2.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      });
      const queue = await listReviewQueue(
        { scopedCategoryIds: null },
        { limit: 50 },
      );
      assert.equal(
        queue.items.some((row) => row.versionId === v2.versionId),
        true,
      );
      await approveVersion(created.contentItemId, v2.versionId, {
        expectedUpdatedAt: submittedV2.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffReviewerA,
      });

      const now = new Date();
      const scheduled = await scheduleVersion(
        created.contentItemId,
        v2.versionId,
        new Date(now.getTime() + 60_000),
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
        now,
      );
      const staleGeneration = scheduled.scheduleGeneration;
      const unscheduled = await unscheduleVersion(
        created.contentItemId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      );
      assert.equal(unscheduled.draftVersionId, v2.versionId);

      const recovered = await snapshotContent(created.contentItemId, v2.versionId);
      assert.equal(recovered.publishedVersionId, created.versionId);
      assert.equal(recovered.draftVersionId, v2.versionId);
      assert.equal(recovered.scheduledVersionId, null);
      assert.equal(recovered.workflowStatus, WORKFLOW_STATUS.APPROVED);

      const rescheduledAt = new Date(now.getTime() + 90_000);
      const rescheduled = await scheduleVersion(
        created.contentItemId,
        v2.versionId,
        rescheduledAt,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
        now,
      );
      const stale = await executeScheduledPublish(
        created.contentItemId,
        staleGeneration,
        rescheduledAt,
      );
      assert.equal(stale.outcome, SCHEDULED_PUBLISH_DECISION.NOOP_STALE);

      const executed = await executeScheduledPublish(
        created.contentItemId,
        rescheduled.scheduleGeneration,
        rescheduledAt,
      );
      assert.equal(executed.outcome, SCHEDULED_PUBLISH_DECISION.EXECUTE);

      const published = await snapshotContent(created.contentItemId, v2.versionId);
      assert.equal(published.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
      assert.equal(published.publishedVersionId, v2.versionId);
      assert.equal(published.draftVersionId, null);
      assert.equal(published.scheduledVersionId, null);
      assert.equal(published.title, "Lifecycle v2");

      const original = await snapshotContent(created.contentItemId, created.versionId);
      assert.equal(original.title, "Lifecycle v1 saved");
      assert.equal(original.publishedVersionId, v2.versionId);
    });
  });
});
