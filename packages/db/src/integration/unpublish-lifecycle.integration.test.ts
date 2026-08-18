import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  CAPABILITY,
  CONTENT_AUDIT_EVENT_TYPE,
  PUBLICATION_STATUS,
  PUBLISHING_ERROR,
  PublishingError,
  SCHEDULED_PUBLISH_DECISION,
  STAFF_ROLE,
  WORKFLOW_STATUS,
  hasCapability,
  publicPublishedVersionId,
} from "@magazine/domain";
import { getArticleEditorModel, listContentAuditEvents } from "../editor";
import {
  approveVersion,
  assertEditableVersion,
  createDraftRevision,
  executeScheduledPublish,
  getContentItem,
  publishVersion,
  scheduleVersion,
  submitForReview,
  unpublishContent,
  updateDraftContent,
} from "../publishing";
import {
  clearPublishingTestHooks,
  setPublishingTestHooks,
} from "../publishing/test-hooks";
import {
  articleBody,
  cleanupFixture,
  closeIntegrationConnections,
  countLeftoverFixtures,
  countOpenTestTransactions,
  createDraftItem,
  createFixture,
  deferred,
  ensureEditorContentTestDatabase,
  snapshotContent,
  type IntegrationFixture,
} from "./harness";

function assertPublishingCode(error: unknown, code: string): void {
  assert.equal(error instanceof PublishingError, true, String(error));
  assert.equal((error as PublishingError).code, code);
}

async function countUnpublishAudits(
  contentItemId: string,
  fixture: IntegrationFixture,
): Promise<number> {
  const audit = await listContentAuditEvents(contentItemId, fixture.superAdmin, {
    limit: 50,
    cursor: null,
  });
  return (
    audit?.items.filter(
      (event) => event.eventType === CONTENT_AUDIT_EVENT_TYPE.CONTENT_UNPUBLISHED,
    ).length ?? 0
  );
}

describe("unpublish publication withdrawal lifecycle", () => {
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

  async function publishApproved(title = "Live article") {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title,
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
    return { created, published };
  }

  it("withdraws a published article without deleting the last published version", async () => {
    const { created, published } = await publishApproved();
    const before = await snapshotContent(created.contentItemId, created.versionId);

    const result = await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    assert.equal(result.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(result.publishedVersionId, created.versionId);
    assert.equal(result.updatedAt instanceof Date, true);

    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(after.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(after.publishedVersionId, created.versionId);
    assert.equal(after.draftVersionId, null);
    assert.equal(after.workflowStatus, WORKFLOW_STATUS.APPROVED);
    assert.equal(after.title, before.title);
    assert.deepEqual(after.body, before.body);
    assert.deepEqual(after.categories, before.categories);
    assert.equal(after.updatedAtMs > before.updatedAtMs, true);
    assert.equal(published.publishedVersionId, created.versionId);
    assert.equal(await countUnpublishAudits(created.contentItemId, fixture), 1);
  });

  it("rejects unpublish of a never-published item without mutation", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
    });
    const before = await snapshotContent(created.contentItemId, created.versionId);

    await assert.rejects(
      unpublishContent(
        created.contentItemId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.NOT_PUBLISHED);
        return true;
      },
    );

    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(after.publicationStatus, PUBLICATION_STATUS.NEVER_PUBLISHED);
    assert.equal(after.publishedVersionId, null);
    assert.equal(after.updatedAtMs, before.updatedAtMs);
    assert.equal(await countUnpublishAudits(created.contentItemId, fixture), 0);
  });

  it("rejects a repeated unpublish without a second audit event", async () => {
    const { created } = await publishApproved();
    await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    const afterFirst = await snapshotContent(created.contentItemId, created.versionId);

    await assert.rejects(
      unpublishContent(
        created.contentItemId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.NOT_PUBLISHED);
        return true;
      },
    );

    const afterSecond = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(afterSecond.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(afterSecond.publishedVersionId, created.versionId);
    assert.equal(afterSecond.updatedAtMs, afterFirst.updatedAtMs);
    assert.equal(await countUnpublishAudits(created.contentItemId, fixture), 1);
  });

  it("keeps an active draft intact when the live article is withdrawn", async () => {
    const { created } = await publishApproved();
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
      title: "Draft successor",
      body: articleBody("draft-successor"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
    });

    await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const item = await getContentItem(created.contentItemId);
    const v1 = await snapshotContent(created.contentItemId, created.versionId);
    const v2 = await snapshotContent(created.contentItemId, revision.versionId);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(item.publishedVersionId, created.versionId);
    assert.equal(item.draftVersionId, revision.versionId);
    assert.equal(v1.workflowStatus, WORKFLOW_STATUS.APPROVED);
    assert.equal(v2.workflowStatus, WORKFLOW_STATUS.DRAFT);
    assert.equal(v2.title, "Draft successor");
    await assertEditableVersion(created.contentItemId, revision.versionId);
    assert.equal(saved.versionId, revision.versionId);
  });

  it("does not mutate an IN_REVIEW successor when unpublishing", async () => {
    const { created } = await publishApproved();
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
      title: "In review successor",
      body: articleBody("in-review"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
    });
    await submitForReview(created.contentItemId, revision.versionId, {
      expectedUpdatedAt: saved.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });

    await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const item = await getContentItem(created.contentItemId);
    const v2 = await snapshotContent(created.contentItemId, revision.versionId);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(item.draftVersionId, revision.versionId);
    assert.equal(v2.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
  });

  it("does not mutate an APPROVED successor when unpublishing", async () => {
    const { created } = await publishApproved();
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
      title: "Approved successor",
      body: articleBody("approved-successor"),
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

    await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const item = await getContentItem(created.contentItemId);
    const v2 = await snapshotContent(created.contentItemId, revision.versionId);
    assert.equal(item.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(item.publishedVersionId, created.versionId);
    assert.equal(item.draftVersionId, revision.versionId);
    assert.equal(v2.workflowStatus, WORKFLOW_STATUS.APPROVED);
  });

  it("leaves a scheduled replacement active and later executes at the current generation", async () => {
    const { created } = await publishApproved();
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
      title: "Scheduled replacement",
      body: articleBody("scheduled-replacement"),
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
    const scheduledAt = new Date(now.getTime() + 60_000);
    const scheduled = await scheduleVersion(
      created.contentItemId,
      revision.versionId,
      scheduledAt,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
      now,
    );
    const generation = scheduled.scheduleGeneration;

    await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const withdrawn = await getContentItem(created.contentItemId);
    assert.equal(withdrawn.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(withdrawn.publishedVersionId, created.versionId);
    assert.equal(withdrawn.scheduledVersionId, revision.versionId);
    assert.equal(withdrawn.scheduleGeneration, generation);
    assert.equal(publicPublishedVersionId(withdrawn), null);

    const stale = await executeScheduledPublish(
      created.contentItemId,
      generation - 1,
      scheduledAt,
    );
    assert.equal(stale.outcome, SCHEDULED_PUBLISH_DECISION.NOOP_STALE);
    const afterStale = await getContentItem(created.contentItemId);
    assert.equal(afterStale.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(afterStale.scheduledVersionId, revision.versionId);

    const executed = await executeScheduledPublish(
      created.contentItemId,
      generation,
      scheduledAt,
    );
    assert.equal(executed.outcome, SCHEDULED_PUBLISH_DECISION.EXECUTE);
    const live = await getContentItem(created.contentItemId);
    assert.equal(live.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(live.publishedVersionId, revision.versionId);
    assert.equal(live.scheduledVersionId, null);
    assert.equal(publicPublishedVersionId(live), revision.versionId);
  });

  it("stops exposing the item as publicly published after unpublish", async () => {
    const { created } = await publishApproved();
    const live = await getContentItem(created.contentItemId);
    assert.equal(publicPublishedVersionId(live), created.versionId);

    await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const withdrawn = await getContentItem(created.contentItemId);
    assert.equal(withdrawn.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(withdrawn.publishedVersionId, created.versionId);
    assert.equal(publicPublishedVersionId(withdrawn), null);
    const model = await getArticleEditorModel(created.contentItemId);
    assert.equal(model?.contentItem.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(model?.contentItem.id, created.contentItemId);
  });

  it("does not treat CONTENT_EDIT as publication permission at the capability gate", async () => {
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.CONTENT_EDIT), true);
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.CONTENT_REVIEW), false);
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.CONTENT_PUBLISH), false);
    const { created } = await publishApproved();
    await unpublishContent(
      created.contentItemId,
      fixture.selectedOnA,
      fixture.ids.staffReviewerA,
    );
    const after = await getContentItem(created.contentItemId);
    assert.equal(after.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
  });

  it("rejects unpublish outside category scope without leaking existence", async () => {
    const { created } = await publishApproved();
    const before = await snapshotContent(created.contentItemId, created.versionId);

    await assert.rejects(
      unpublishContent(
        created.contentItemId,
        fixture.selectedOnB,
        fixture.ids.staffReviewerB,
      ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      },
    );

    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(after.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(after.publishedVersionId, created.versionId);
    assert.equal(after.updatedAtMs, before.updatedAtMs);
    assert.equal(await countUnpublishAudits(created.contentItemId, fixture), 0);
  });

  it("does not report success for a concurrent unpublish after the first withdrawal", async () => {
    const { created } = await publishApproved();
    let paused = false;
    const locked = deferred();
    const resume = deferred();
    setPublishingTestHooks({
      afterContentItemLocked: async ({ contentItemId }) => {
        if (contentItemId !== created.contentItemId) {
          return;
        }
        if (paused) {
          return;
        }
        paused = true;
        locked.resolve();
        await resume.promise;
      },
    });

    const first = unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    await locked.promise;
    const second = unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    resume.resolve();

    const firstResult = await first;
    assert.equal(firstResult.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    await assert.rejects(second, (error: unknown) => {
      assertPublishingCode(error, PUBLISHING_ERROR.NOT_PUBLISHED);
      return true;
    });
    assert.equal(await countUnpublishAudits(created.contentItemId, fixture), 1);
  });

  it("completes the full lifecycle through unpublish and later republish of V2", async () => {
    const { created } = await publishApproved("Lifecycle V1");
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
      title: "Lifecycle V2",
      body: articleBody("lifecycle-v2"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
    });

    await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const withdrawn = await getContentItem(created.contentItemId);
    const v1 = await snapshotContent(created.contentItemId, created.versionId);
    const v2 = await snapshotContent(created.contentItemId, revision.versionId);
    assert.equal(withdrawn.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(withdrawn.publishedVersionId, created.versionId);
    assert.equal(withdrawn.draftVersionId, revision.versionId);
    assert.equal(v1.workflowStatus, WORKFLOW_STATUS.APPROVED);
    assert.equal(v1.title, "Lifecycle V1");
    assert.equal(v2.workflowStatus, WORKFLOW_STATUS.DRAFT);
    assert.equal(v2.title, "Lifecycle V2");

    const submitted = await submitForReview(created.contentItemId, revision.versionId, {
      expectedUpdatedAt: withdrawn.updatedAt,
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

    const live = await getContentItem(created.contentItemId);
    assert.equal(live.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(live.publishedVersionId, revision.versionId);
    assert.equal(publicPublishedVersionId(live), revision.versionId);
  });
});
