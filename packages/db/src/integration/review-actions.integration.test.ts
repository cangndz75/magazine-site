import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { asc, eq } from "drizzle-orm";
import {
  PUBLICATION_STATUS,
  PUBLISHING_ERROR,
  PublishingError,
  REVIEW_EVENT_TYPE,
  REVIEW_NOTE_MAX_LENGTH,
  WORKFLOW_STATUS,
  decodeEditorReviewQueueCursor,
} from "@magazine/domain";
import {
  listContentReviewHistory,
  listReviewQueue,
} from "../editor";
import { getDb } from "../client";
import {
  approveVersion,
  createDraftRevision,
  getContentItem,
  getContentVersion,
  publishVersion,
  requestChanges,
  submitForReview,
  updateDraftContent,
} from "../publishing";
import { clearPublishingTestHooks, setPublishingTestHooks } from "../publishing/test-hooks";
import { contentReviewEvents } from "../schema/review-events";
import { contentVersions } from "../schema/content";
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
  getRacerPool,
  persistUpdatedAtMs,
  primaryA,
  replaceVersionCategoriesDirect,
  requiredTimestampMs,
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

describe("editorial review actions PostgreSQL", () => {
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

  async function submitDraft(
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

  describe("approve", () => {
    it("approves the exact IN_REVIEW version without publishing", async () => {
      const created = await createDraftItem(fixture);
      const before = await snapshotContent(created.contentItemId, created.versionId);
      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      const approved = await approveVersion(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: submitted.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffReviewerA,
          note: "Looks good",
        },
      );

      assert.equal(approved.workflowStatus, WORKFLOW_STATUS.APPROVED);
      const version = await getContentVersion(created.versionId);
      const item = await getContentItem(created.contentItemId);
      assert.equal(version.workflowStatus, WORKFLOW_STATUS.APPROVED);
      assert.equal(item.publicationStatus, before.publicationStatus);
      assert.equal(item.publishedVersionId, before.publishedVersionId);
      assert.equal(item.draftVersionId, created.versionId);
      const persisted = await persistUpdatedAtMs(created.contentItemId);
      assert.equal(persisted, requiredTimestampMs(approved.updatedAt));
      assert.equal(persisted > requiredTimestampMs(submitted.updatedAt), true);

      const events = await listEvents(created.contentItemId);
      assert.deepEqual(
        events.map((event) => event.eventType),
        [REVIEW_EVENT_TYPE.SUBMITTED, REVIEW_EVENT_TYPE.APPROVED],
      );
      assert.equal(events[1]?.actorId, fixture.ids.staffReviewerA);
      assert.equal(events[1]?.note, "Looks good");
    });

    it("rejects a stale approval token without mutating workflow or events", async () => {
      const created = await createDraftItem(fixture);
      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      await assert.rejects(
        () =>
          approveVersion(created.contentItemId, created.versionId, {
            expectedUpdatedAt: created.updatedAt,
            scope: fixture.superAdmin,
            actorId: fixture.ids.staffReviewerA,
          }),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
          return true;
        },
      );

      const version = await getContentVersion(created.versionId);
      assert.equal(version.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
      const events = await listEvents(created.contentItemId);
      assert.deepEqual(
        events.map((event) => event.eventType),
        [REVIEW_EVENT_TYPE.SUBMITTED],
      );
      void submitted;
    });

    it("rejects approve from DRAFT or already APPROVED", async () => {
      const created = await createDraftItem(fixture);
      await assert.rejects(
        () =>
          approveVersion(created.contentItemId, created.versionId, {
            expectedUpdatedAt: created.updatedAt,
            scope: fixture.superAdmin,
            actorId: fixture.ids.staffReviewerA,
          }),
        (error: unknown) => {
          assertPublishingCode(
            error,
            PUBLISHING_ERROR.INVALID_WORKFLOW_TRANSITION,
          );
          return true;
        },
      );

      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      const approved = await approveVersion(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: submitted.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffReviewerA,
        },
      );
      await assert.rejects(
        () =>
          approveVersion(created.contentItemId, created.versionId, {
            expectedUpdatedAt: approved.updatedAt,
            scope: fixture.superAdmin,
            actorId: fixture.ids.staffReviewerA,
          }),
        (error: unknown) => {
          assertPublishingCode(
            error,
            PUBLISHING_ERROR.INVALID_WORKFLOW_TRANSITION,
          );
          return true;
        },
      );
    });

    it("rejects SELECTED review of an out-of-scope IN_REVIEW primary", async () => {
      const created = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
      });
      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      await assert.rejects(
        () =>
          approveVersion(created.contentItemId, created.versionId, {
            expectedUpdatedAt: submitted.updatedAt,
            scope: fixture.selectedOnA,
            actorId: fixture.ids.staffReviewerA,
          }),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
          return true;
        },
      );
      const version = await getContentVersion(created.versionId);
      assert.equal(version.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
      assert.equal((await listEvents(created.contentItemId)).length, 1);
    });
  });

  describe("request changes", () => {
    it("returns the version to DRAFT with a durable reviewer note", async () => {
      const created = await createDraftItem(fixture);
      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      const before = await snapshotContent(created.contentItemId, created.versionId);
      const returned = await requestChanges(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: submitted.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffReviewerA,
          note: "Restore the standfirst.",
        },
      );

      assert.equal(returned.workflowStatus, WORKFLOW_STATUS.DRAFT);
      const version = await getContentVersion(created.versionId);
      const item = await getContentItem(created.contentItemId);
      assert.equal(version.workflowStatus, WORKFLOW_STATUS.DRAFT);
      assert.equal(item.publicationStatus, before.publicationStatus);
      assert.equal(item.publishedVersionId, before.publishedVersionId);
      assert.equal(item.scheduledVersionId, before.scheduledVersionId);
      assert.equal(item.draftVersionId, created.versionId);
      const persisted = await persistUpdatedAtMs(created.contentItemId);
      assert.equal(persisted, requiredTimestampMs(returned.updatedAt));
      assert.equal(persisted > requiredTimestampMs(submitted.updatedAt), true);

      const events = await listEvents(created.contentItemId);
      assert.equal(events[1]?.eventType, REVIEW_EVENT_TYPE.CHANGES_REQUESTED);
      assert.equal(events[1]?.note, "Restore the standfirst.");
      assert.equal(events[1]?.actorId, fixture.ids.staffReviewerA);
    });

    it("rejects empty, whitespace, and oversized reviewer notes", async () => {
      const created = await createDraftItem(fixture);
      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );

      for (const note of ["", "   ", "x".repeat(REVIEW_NOTE_MAX_LENGTH + 1)]) {
        await assert.rejects(
          () =>
            requestChanges(created.contentItemId, created.versionId, {
              expectedUpdatedAt: submitted.updatedAt,
              scope: fixture.superAdmin,
              actorId: fixture.ids.staffReviewerA,
              note,
            }),
          (error: unknown) => {
            assertPublishingCode(error, PUBLISHING_ERROR.INVALID_REVIEW_NOTE);
            return true;
          },
        );
      }

      const version = await getContentVersion(created.versionId);
      assert.equal(version.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
      assert.equal((await listEvents(created.contentItemId)).length, 1);
    });

    it("rejects a stale request-changes token", async () => {
      const created = await createDraftItem(fixture);
      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      await assert.rejects(
        () =>
          requestChanges(created.contentItemId, created.versionId, {
            expectedUpdatedAt: created.updatedAt,
            scope: fixture.superAdmin,
            actorId: fixture.ids.staffReviewerA,
            note: "Too late",
          }),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
          return true;
        },
      );
      void submitted;
    });

    it("rejects SELECTED request-changes on an out-of-scope target", async () => {
      const created = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
      });
      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      await assert.rejects(
        () =>
          requestChanges(created.contentItemId, created.versionId, {
            expectedUpdatedAt: submitted.updatedAt,
            scope: fixture.selectedOnA,
            actorId: fixture.ids.staffReviewerA,
            note: "Out of scope",
          }),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
          return true;
        },
      );
    });
  });

  describe("repeated review rounds", () => {
    it("appends SUBMITTED, CHANGES_REQUESTED, SUBMITTED, APPROVED without overwrite", async () => {
      const created = await createDraftItem(fixture);
      const firstSubmit = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      const changes = await requestChanges(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: firstSubmit.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffReviewerA,
          note: "Tighten the lede.",
        },
      );
      const edited = await updateDraftContent({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt: changes.updatedAt,
        title: "Revised title",
        body: articleBody("revised"),
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
        categories: primaryA(fixture),
      });
      const secondSubmit = await submitDraft(
        created.contentItemId,
        created.versionId,
        edited.updatedAt,
      );

      const queue = await listReviewQueue(
        { scopedCategoryIds: null },
        { limit: 50 },
      );
      const row = queue.items.find((item) => item.versionId === created.versionId);
      assert.equal(row?.reviewRound, 2);
      const eventsDuringReview = await listEvents(created.contentItemId);
      const secondSubmittedAt = eventsDuringReview.filter(
        (event) => event.eventType === REVIEW_EVENT_TYPE.SUBMITTED,
      )[1]?.createdAt;
      assert.equal(
        requiredTimestampMs(row!.latestSubmittedAt),
        requiredTimestampMs(secondSubmittedAt!),
      );

      await approveVersion(created.contentItemId, created.versionId, {
        expectedUpdatedAt: secondSubmit.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffReviewerB,
      });

      const events = await listEvents(created.contentItemId);
      assert.deepEqual(
        events.map((event) => event.eventType),
        [
          REVIEW_EVENT_TYPE.SUBMITTED,
          REVIEW_EVENT_TYPE.CHANGES_REQUESTED,
          REVIEW_EVENT_TYPE.SUBMITTED,
          REVIEW_EVENT_TYPE.APPROVED,
        ],
      );
      assert.equal(events[0]?.note, null);
      assert.equal(events[1]?.note, "Tighten the lede.");
      assert.equal(events[2]?.note, null);
    });
  });

  describe("concurrent contradictory decisions", () => {
    it("allows only one of approve or request-changes to commit", async () => {
      const created = await createDraftItem(fixture);
      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );

      const results = await Promise.allSettled([
        approveVersion(created.contentItemId, created.versionId, {
          expectedUpdatedAt: submitted.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffReviewerA,
        }),
        requestChanges(created.contentItemId, created.versionId, {
          expectedUpdatedAt: submitted.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffReviewerB,
          note: "Hold this back.",
        }),
      ]);

      const fulfilled = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      assert.equal(fulfilled.length, 1);
      assert.equal(rejected.length, 1);
      assertPublishingCode(
        (rejected[0] as PromiseRejectedResult).reason,
        PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT,
      );

      const events = await listEvents(created.contentItemId);
      const terminal = events.filter(
        (event) =>
          event.eventType === REVIEW_EVENT_TYPE.APPROVED ||
          event.eventType === REVIEW_EVENT_TYPE.CHANGES_REQUESTED,
      );
      assert.equal(terminal.length, 1);
      const version = await getContentVersion(created.versionId);
      if (terminal[0]?.eventType === REVIEW_EVENT_TYPE.APPROVED) {
        assert.equal(version.workflowStatus, WORKFLOW_STATUS.APPROVED);
      } else {
        assert.equal(version.workflowStatus, WORKFLOW_STATUS.DRAFT);
      }
    });
  });

  describe("category TOCTOU", () => {
    it("authorizes the locked review version after FOR UPDATE", async () => {
      const created = await createDraftItem(fixture);
      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      const beforeEvents = await listEvents(created.contentItemId);

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

      const mutation = approveVersion(created.contentItemId, created.versionId, {
        expectedUpdatedAt: submitted.updatedAt,
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffReviewerA,
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

      const version = await getContentVersion(created.versionId);
      assert.equal(version.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
      assert.equal(
        (await listEvents(created.contentItemId)).length,
        beforeEvents.length,
      );
    });
  });

  describe("queue ordering", () => {
    it("orders by latest SUBMITTED time, not version createdAt", async () => {
      const earlierDraft = await createDraftItem(fixture, { title: "Created first" });
      await new Promise((resolve) => setTimeout(resolve, 20));
      const laterDraft = await createDraftItem(fixture, { title: "Created second" });

      const laterSubmit = await submitDraft(
        laterDraft.contentItemId,
        laterDraft.versionId,
        laterDraft.updatedAt,
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      const earlierSubmit = await submitDraft(
        earlierDraft.contentItemId,
        earlierDraft.versionId,
        earlierDraft.updatedAt,
      );

      const queue = await listReviewQueue(
        { scopedCategoryIds: null },
        { limit: 50 },
      );
      const ids = queue.items.map((row) => row.versionId);
      const laterIndex = ids.indexOf(laterDraft.versionId);
      const earlierIndex = ids.indexOf(earlierDraft.versionId);
      assert.equal(laterIndex >= 0, true);
      assert.equal(earlierIndex >= 0, true);
      assert.equal(laterIndex < earlierIndex, true);
      void laterSubmit;
      void earlierSubmit;
    });

    it("keeps legacy IN_REVIEW rows without SUBMITTED events visible and sortable", async () => {
      const created = await createDraftItem(fixture, { title: "Legacy review" });
      const db = getDb();
      await db
        .update(contentVersions)
        .set({ workflowStatus: WORKFLOW_STATUS.IN_REVIEW })
        .where(eq(contentVersions.id, created.versionId));
      const other = await createDraftItem(fixture, { title: "Submitted review" });
      await submitDraft(other.contentItemId, other.versionId, other.updatedAt);

      const queue = await listReviewQueue(
        { scopedCategoryIds: null },
        { limit: 50 },
      );
      const row = queue.items.find((item) => item.versionId === created.versionId);
      assert.equal(row?.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
      assert.equal(row?.reviewRound, 0);
      assert.equal(
        requiredTimestampMs(row!.latestSubmittedAt),
        requiredTimestampMs(row!.createdAt),
      );

      const page1 = await listReviewQueue(
        { scopedCategoryIds: null },
        { limit: 1 },
      );
      assert.equal(typeof page1.nextCursor, "string");
      const page2 = await listReviewQueue(
        { scopedCategoryIds: null },
        {
          limit: 50,
          cursor: decodeEditorReviewQueueCursor(page1.nextCursor ?? undefined),
        },
      );
      const combined = [
        ...page1.items.map((item) => item.versionId),
        ...page2.items.map((item) => item.versionId),
      ];
      assert.equal(new Set(combined).size, combined.length);
      assert.equal(combined.includes(created.versionId), true);
      assert.equal(combined.includes(other.versionId), true);
    });
  });

  describe("review history authorization", () => {
    it("returns actor summaries and notes for authorized readers", async () => {
      const created = await createDraftItem(fixture);
      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      await requestChanges(created.contentItemId, created.versionId, {
        expectedUpdatedAt: submitted.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffReviewerA,
        note: "Need a sharper dek.",
      });

      const history = await listContentReviewHistory(
        created.contentItemId,
        fixture.superAdmin,
      );
      assert.equal(history.events.length, 2);
      assert.equal(history.events[1]?.note, "Need a sharper dek.");
      assert.equal(history.events[1]?.actor.id, fixture.ids.staffReviewerA);
      assert.equal(history.events[1]?.actor.displayName, "Itest Reviewer A");
      assert.equal(Object.hasOwn(history.events[1]!.actor, "email"), false);
      const serialized = JSON.stringify(history);
      assert.equal(serialized.includes("@itest.local"), false);
      assert.equal(serialized.includes("token"), false);
    });

    it("masks inaccessible items and does not treat an event UUID as an item id", async () => {
      const created = await createDraftItem(fixture, {
        categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
        scope: fixture.superAdmin,
      });
      await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      const events = await listEvents(created.contentItemId);

      await assert.rejects(
        () => listContentReviewHistory(created.contentItemId, fixture.selectedOnA),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
          return true;
        },
      );
      await assert.rejects(
        () =>
          listContentReviewHistory(events[0]!.id, fixture.superAdmin),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
          return true;
        },
      );
    });
  });

  describe("publication isolation", () => {
    it("leaves a live published pointer untouched after request-changes", async () => {
      const created = await createDraftItem(fixture);
      const submitted = await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      const approved = await approveVersion(
        created.contentItemId,
        created.versionId,
        {
          expectedUpdatedAt: submitted.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffReviewerA,
        },
      );
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
      const saved = await updateDraftContent({
        contentItemId: created.contentItemId,
        versionId: revision.versionId,
        expectedUpdatedAt: revision.updatedAt,
        title: "Next draft",
        body: articleBody("next"),
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
        categories: primaryA(fixture),
      });
      const review = await submitDraft(
        created.contentItemId,
        revision.versionId,
        saved.updatedAt,
      );

      const itemBefore = await getContentItem(created.contentItemId);
      await requestChanges(created.contentItemId, revision.versionId, {
        expectedUpdatedAt: review.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffReviewerA,
        note: "Needs another pass.",
      });
      const itemAfter = await getContentItem(created.contentItemId);
      assert.equal(itemAfter.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
      assert.equal(itemAfter.publishedVersionId, created.versionId);
      assert.equal(itemAfter.scheduledVersionId, itemBefore.scheduledVersionId);
      const next = await getContentVersion(revision.versionId);
      assert.equal(next.workflowStatus, WORKFLOW_STATUS.DRAFT);
      void approved;
    });
  });

  describe("one IN_REVIEW version", () => {
    it("rejects a second IN_REVIEW version for the same item at the database", async () => {
      const created = await createDraftItem(fixture);
      await submitDraft(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      const pool = getRacerPool();
      await assert.rejects(
        () =>
          pool.query(
            `INSERT INTO content_versions (
               content_item_id, version_number, workflow_status, title, body
             ) VALUES ($1, 2, 'IN_REVIEW', 'other', '{"blocks":[]}'::jsonb)`,
            [created.contentItemId],
          ),
        (error: unknown) => {
          assert.equal(
            error instanceof Error && "code" in error
              ? (error as { code: string }).code
              : null,
            "23505",
          );
          return true;
        },
      );
    });
  });
});
