import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  PUBLISHING_ERROR,
  PublishingError,
  WORKFLOW_STATUS,
} from "@magazine/domain";
import { listContentAuditEvents } from "../editor";
import {
  approveVersion,
  createContent,
  publishVersion,
  submitForReview,
  updateDraftScalarFields,
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
  createDraftItem,
  createFixture,
  ensureEditorContentTestDatabase,
  primaryA,
  requiredTimestampMs,
  snapshotContent,
  type IntegrationFixture,
} from "./harness";

describe("content audit PostgreSQL integration", () => {
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
    await closeIntegrationConnections();
  });

  it("records a compact creation audit event", async () => {
    const created = await createContent({
      slug: `audit-${Date.now()}`,
      title: "Audit created",
      body: articleBody("audit-create"),
      categories: primaryA(fixture),
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
    });
    fixture.createdItemIds.push(created.contentItemId);

    const audit = await listContentAuditEvents(
      created.contentItemId,
      fixture.selectedOnA,
      { limit: 10, cursor: null },
    );

    assert.equal(audit?.items.length, 1);
    assert.equal(audit?.items[0]?.eventType, CONTENT_AUDIT_EVENT_TYPE.CONTENT_CREATED);
    assert.equal(audit?.items[0]?.actor.staffUserId, fixture.ids.staffEditor);
    assert.equal(audit?.items[0]?.versionId, created.versionId);
    assert.equal(audit?.items[0]?.changeSet, null);
  });

  it("records only changed scalar fields for article editor saves", async () => {
    const created = await createDraftItem(fixture, { includeRelations: true });
    const saved = await updateDraftScalarFields({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      title: "Audit scalar title",
      excerpt: "Audit excerpt",
      sourceUrl: "https://example.test/source",
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
    });

    const audit = await listContentAuditEvents(
      created.contentItemId,
      fixture.selectedOnA,
      { limit: 10, cursor: null },
    );

    const event = audit!.items.find(
      (item) => item.eventType === CONTENT_AUDIT_EVENT_TYPE.DRAFT_UPDATED,
    )!;
    assert.equal(audit?.items.length, 2);
    assert.equal(event.eventType, CONTENT_AUDIT_EVENT_TYPE.DRAFT_UPDATED);
    assert.equal(event.actor.staffUserId, fixture.ids.staffEditor);
    assert.equal(event.contentItemId, created.contentItemId);
    assert.equal(event.versionId, created.versionId);
    assert.equal(requiredTimestampMs(event.occurredAt) <= requiredTimestampMs(saved.updatedAt), true);
    assert.deepEqual(event.changeSet?.scalarChanges, [
      { field: "title", before: "Original title", after: "Audit scalar title" },
      { field: "excerpt", before: null, after: "Audit excerpt" },
      { field: "sourceUrl", before: null, after: "https://example.test/source" },
    ]);
  });

  it("does not audit stale failed writes", async () => {
    const created = await createDraftItem(fixture);
    const saved = await updateDraftScalarFields({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      title: "Winning title",
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
    });

    await assert.rejects(
      () =>
        updateDraftScalarFields({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          title: "Stale title",
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
        }),
      (error: unknown) =>
        error instanceof PublishingError &&
        error.code === PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT,
    );

    const audit = await listContentAuditEvents(
      created.contentItemId,
      fixture.selectedOnA,
      { limit: 10, cursor: null },
    );
    assert.equal(audit?.items.length, 2);
    const draftUpdated = audit!.items.find(
      (item) => item.eventType === CONTENT_AUDIT_EVENT_TYPE.DRAFT_UPDATED,
    )!;
    assert.equal(requiredTimestampMs(draftUpdated.occurredAt) <= requiredTimestampMs(saved.updatedAt), true);
  });

  it("rolls back the content mutation when audit insertion fails", async () => {
    const created = await createDraftItem(fixture);
    const before = await snapshotContent(created.contentItemId, created.versionId);
    setPublishingTestHooks({
      beforeAuditEventInserted: async () => {
        throw new Error("INTEGRATION_FORCED_AUDIT_FAILURE");
      },
    });

    await assert.rejects(
      () =>
        updateDraftScalarFields({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          title: "Should roll back",
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
        }),
      /INTEGRATION_FORCED_AUDIT_FAILURE/,
    );

    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.deepEqual(after, before);
  });

  it("records review and publication events without replacing review history", async () => {
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
    await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.selectedOnA,
      fixture.ids.staffReviewerA,
    );

    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(after.workflowStatus, WORKFLOW_STATUS.APPROVED);
    assert.equal(after.publishedVersionId, created.versionId);

    const audit = await listContentAuditEvents(
      created.contentItemId,
      fixture.selectedOnA,
      { limit: 10, cursor: null },
    );
    assert.deepEqual(
      audit?.items.map((item) => item.eventType).sort(),
      [
        CONTENT_AUDIT_EVENT_TYPE.CONTENT_CREATED,
        CONTENT_AUDIT_EVENT_TYPE.CONTENT_PUBLISHED,
        CONTENT_AUDIT_EVENT_TYPE.REVIEW_APPROVED,
        CONTENT_AUDIT_EVENT_TYPE.REVIEW_SUBMITTED,
      ].sort(),
    );
    assert.equal(requiredTimestampMs(audit!.items[0]!.occurredAt) >= requiredTimestampMs(approved.updatedAt), true);
  });

  it("masks audit reads for out-of-scope selected users", async () => {
    const created = await createDraftItem(fixture);
    await updateDraftScalarFields({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      title: "Scoped title",
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
    });

    const authorized = await listContentAuditEvents(
      created.contentItemId,
      fixture.selectedOnA,
      { limit: 10, cursor: null },
    );
    const denied = await listContentAuditEvents(
      created.contentItemId,
      fixture.selectedOnB,
      { limit: 10, cursor: null },
    );

    assert.equal(authorized?.items.length, 2);
    assert.equal(denied, null);
  });
});
