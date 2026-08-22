import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  AUTHOR_ROLE,
  CONTENT_KIND,
  PUBLICATION_STATUS,
  PUBLISHING_ERROR,
  PublishingError,
  WORKFLOW_STATUS,
  decodeEditorReviewQueueCursor,
  decodeEditorRevisionCursor,
  scopedCategoryIdsForQuery,
} from "@magazine/domain";
import {
  getArticleEditorModel,
  listContentRevisionHistory,
  listEditorCalendarItems,
  listReviewQueue,
} from "../editor";
import {
  approveVersion,
  createDraftRevision,
  publishVersion,
  scheduleVersion,
  submitForReview,
  updateDraftContent,
} from "../publishing";
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
  primaryA,
  type IntegrationFixture,
} from "./harness";

function assertPublishingCode(error: unknown, code: string): void {
  assert.equal(error instanceof PublishingError, true, String(error));
  assert.equal((error as PublishingError).code, code);
}

describe("editorial workflow PostgreSQL reads", () => {
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

  async function createInReview(title: string, categoryId: string) {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title,
      includeRelations: true,
      categories: [{ categoryId, isPrimary: true }],
    });
    const submitted = await submitCurrent(
      created.contentItemId,
      created.versionId,
      created.updatedAt,
    );
    return { created, submitted };
  }

  async function createScheduled(
    title: string,
    scheduledAt: Date,
    input: {
      categoryId?: string;
      authorId?: string;
      contentKind?: typeof CONTENT_KIND[keyof typeof CONTENT_KIND];
    } = {},
  ) {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title,
      contentKind: input.contentKind,
      categories: [
        {
          categoryId: input.categoryId ?? fixture.ids.categoryA,
          isPrimary: true,
        },
      ],
      authors: [
        {
          authorId: input.authorId ?? fixture.ids.author,
          role: AUTHOR_ROLE.AUTHOR,
          sortOrder: 0,
        },
      ],
    });
    const submitted = await submitCurrent(
      created.contentItemId,
      created.versionId,
      created.updatedAt,
    );
    const approved = await approveCurrent(
      created.contentItemId,
      created.versionId,
      submitted.updatedAt,
    );
    await scheduleVersion(
      created.contentItemId,
      created.versionId,
      scheduledAt,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    void approved;
    return created;
  }

  describe("revision history", () => {
    it("returns newest-first versions with pointer flags and no body payload", async () => {
      const created = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        includeRelations: true,
      });
      const submitted = await submitCurrent(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      await approveCurrent(
        created.contentItemId,
        created.versionId,
        submitted.updatedAt,
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

      const history = await listContentRevisionHistory(
        created.contentItemId,
        fixture.superAdmin,
        { limit: 50 },
      );

      assert.equal(history.versions.length, 2);
      assert.deepEqual(
        history.versions.map((row) => row.versionNumber),
        [revision.versionNumber, 1],
      );
      assert.equal(history.versions[0]?.id, revision.versionId);
      assert.equal(history.versions[0]?.isCurrentDraft, true);
      assert.equal(history.versions[0]?.isPublishedVersion, false);
      assert.equal(history.versions[1]?.id, created.versionId);
      assert.equal(history.versions[1]?.isPublishedVersion, true);
      assert.equal(history.versions[1]?.isCurrentDraft, false);
      assert.equal(history.draftVersionId, revision.versionId);
      assert.equal(history.publishedVersionId, created.versionId);
      for (const version of history.versions) {
        assert.equal(Object.hasOwn(version, "body"), false);
      }
      void submitted;
    });

    it("masks inaccessible items and does not treat a version UUID as an item id", async () => {
      const created = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
      });

      await assert.rejects(
        () =>
          listContentRevisionHistory(created.contentItemId, fixture.selectedOnA, {
            limit: 20,
          }),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
          return true;
        },
      );

      await assert.rejects(
        () =>
          listContentRevisionHistory(created.versionId, fixture.superAdmin, {
            limit: 20,
          }),
        (error: unknown) => {
          assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
          return true;
        },
      );
    });

    it("paginates by versionNumber without duplicates or skips", async () => {
      const created = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
      });
      const firstSubmit = await submitCurrent(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      await approveCurrent(
        created.contentItemId,
        created.versionId,
        firstSubmit.updatedAt,
      );
      await publishVersion(
        created.contentItemId,
        created.versionId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      );
      const second = await createDraftRevision(
        created.contentItemId,
        undefined,
        fixture.superAdmin,
        fixture.ids.staffEditor,
      );
      const secondSubmit = await submitCurrent(
        created.contentItemId,
        second.versionId,
        second.updatedAt,
      );
      await approveCurrent(
        created.contentItemId,
        second.versionId,
        secondSubmit.updatedAt,
      );
      await publishVersion(
        created.contentItemId,
        second.versionId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      );
      const third = await createDraftRevision(
        created.contentItemId,
        undefined,
        fixture.superAdmin,
        fixture.ids.staffEditor,
      );

      const firstPage = await listContentRevisionHistory(
        created.contentItemId,
        fixture.superAdmin,
        { limit: 2 },
      );
      assert.equal(firstPage.versions.length, 2);
      assert.equal(typeof firstPage.nextCursor, "string");
      assert.deepEqual(
        firstPage.versions.map((row) => row.id),
        [third.versionId, second.versionId],
      );

      const secondPage = await listContentRevisionHistory(
        created.contentItemId,
        fixture.superAdmin,
        {
          limit: 2,
          cursor: decodeEditorRevisionCursor(firstPage.nextCursor ?? undefined),
        },
      );
      assert.deepEqual(
        secondPage.versions.map((row) => row.id),
        [created.versionId],
      );
      assert.equal(secondPage.nextCursor, null);

      const oversized = await listContentRevisionHistory(
        created.contentItemId,
        fixture.superAdmin,
        { limit: 5000 },
      );
      assert.equal(oversized.versions.length, 3);
    });
  });

  describe("review queue", () => {
    it("returns only IN_REVIEW versions, including a newer review on a published item", async () => {
      const draft = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        title: "Still draft",
      });
      const approved = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        title: "Approved only",
        includeRelations: true,
      });
      const approvedSubmit = await submitCurrent(
        approved.contentItemId,
        approved.versionId,
        approved.updatedAt,
      );
      await approveCurrent(
        approved.contentItemId,
        approved.versionId,
        approvedSubmit.updatedAt,
      );

      const published = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        title: "Live",
        includeRelations: true,
      });
      const publishedSubmit = await submitCurrent(
        published.contentItemId,
        published.versionId,
        published.updatedAt,
      );
      await approveCurrent(
        published.contentItemId,
        published.versionId,
        publishedSubmit.updatedAt,
      );
      await publishVersion(
        published.contentItemId,
        published.versionId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      );
      const reviewDraft = await createDraftRevision(
        published.contentItemId,
        undefined,
        fixture.superAdmin,
        fixture.ids.staffEditor,
      );
      const saved = await updateDraftContent({
        contentItemId: published.contentItemId,
        versionId: reviewDraft.versionId,
        expectedUpdatedAt: reviewDraft.updatedAt,
        title: "Newer in review",
        body: articleBody("review-body-must-not-leak"),
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
        categories: primaryA(fixture),
      });
      await submitCurrent(
        published.contentItemId,
        reviewDraft.versionId,
        saved.updatedAt,
      );

      const queue = await listReviewQueue(
        { scopedCategoryIds: null },
        { limit: 50 },
      );
      const ids = queue.items.map((row) => row.versionId);
      assert.equal(ids.includes(draft.versionId), false);
      assert.equal(ids.includes(approved.versionId), false);
      assert.equal(ids.includes(reviewDraft.versionId), true);
      const row = queue.items.find((item) => item.versionId === reviewDraft.versionId);
      assert.equal(row?.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
      assert.equal(row?.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
      assert.equal(row?.publishedVersionId, published.versionId);
      assert.equal(Object.hasOwn(row ?? {}, "body"), false);
      assert.equal(JSON.stringify(row).includes("review-body-must-not-leak"), false);
      void approvedSubmit;
    });

    it("scopes SELECTED editors to the IN_REVIEW version category, not the published category", async () => {
      const live = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        includeRelations: true,
        categories: primaryA(fixture),
        title: "Published A",
      });
      const liveSubmit = await submitCurrent(
        live.contentItemId,
        live.versionId,
        live.updatedAt,
      );
      await approveCurrent(
        live.contentItemId,
        live.versionId,
        liveSubmit.updatedAt,
      );
      await publishVersion(
        live.contentItemId,
        live.versionId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      );

      const revision = await createDraftRevision(
        live.contentItemId,
        undefined,
        fixture.superAdmin,
        fixture.ids.staffEditor,
      );
      const saved = await updateDraftContent({
        contentItemId: live.contentItemId,
        versionId: revision.versionId,
        expectedUpdatedAt: revision.updatedAt,
        title: "Review B",
        body: articleBody("b"),
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
        categories: [{ categoryId: fixture.ids.categoryB, isPrimary: true }],
      });
      await submitCurrent(live.contentItemId, revision.versionId, saved.updatedAt);

      const allowed = await createInReview("Review A", fixture.ids.categoryA);

      const selectedA = await listReviewQueue(
        { scopedCategoryIds: scopedCategoryIdsForQuery(fixture.selectedOnA) },
        { limit: 50 },
      );
      const selectedIds = selectedA.items.map((row) => row.versionId);
      assert.equal(selectedIds.includes(allowed.created.versionId), true);
      assert.equal(selectedIds.includes(revision.versionId), false);

      const selectedB = await listReviewQueue(
        { scopedCategoryIds: scopedCategoryIdsForQuery(fixture.selectedOnB) },
        { limit: 50 },
      );
      assert.equal(
        selectedB.items.some((row) => row.versionId === revision.versionId),
        true,
      );

      const emptySelected = await listReviewQueue(
        { scopedCategoryIds: [] },
        { limit: 50 },
      );
      assert.deepEqual(emptySelected.items, []);

      const globalScope = await listReviewQueue(
        { scopedCategoryIds: null },
        { limit: 50 },
      );
      const globalIds = globalScope.items.map((row) => row.versionId);
      assert.equal(globalIds.includes(allowed.created.versionId), true);
      assert.equal(globalIds.includes(revision.versionId), true);

      const filtered = await listReviewQueue(
        { scopedCategoryIds: scopedCategoryIdsForQuery(fixture.selectedOnA) },
        { limit: 50, categoryId: fixture.ids.categoryB },
      );
      assert.deepEqual(filtered.items, []);
    });

    it("paginates oldest-waiting-first without duplicates when submittedAt ties", async () => {
      const first = await createInReview("Queue one", fixture.ids.categoryA);
      const second = await createInReview("Queue two", fixture.ids.categoryA);
      const third = await createInReview("Queue three", fixture.ids.categoryA);

      const tiedAt = new Date("2026-01-01T00:00:00.000Z");
      await getRacerPool().query(
        `UPDATE content_review_events
         SET created_at = $1
         WHERE event_type = 'SUBMITTED'
           AND content_version_id = ANY($2::uuid[])`,
        [tiedAt, [first.created.versionId, second.created.versionId]],
      );

      const page1 = await listReviewQueue(
        { scopedCategoryIds: null },
        { limit: 2 },
      );
      assert.equal(page1.items.length, 2);
      assert.equal(typeof page1.nextCursor, "string");
      const page1Ids = page1.items.map((row) => row.versionId);
      const page2 = await listReviewQueue(
        { scopedCategoryIds: null },
        {
          limit: 2,
          cursor: decodeEditorReviewQueueCursor(page1.nextCursor ?? undefined),
        },
      );
      const page2Ids = page2.items.map((row) => row.versionId);
      const combined = [...page1Ids, ...page2Ids];
      assert.equal(new Set(combined).size, combined.length);
      assert.equal(combined.includes(first.created.versionId), true);
      assert.equal(combined.includes(second.created.versionId), true);
      assert.equal(combined.includes(third.created.versionId), true);
      assert.equal(
        page1.items[0]!.latestSubmittedAt.getTime() <=
          page1.items[1]!.latestSubmittedAt.getTime(),
        true,
      );
    });
  });

  describe("editorial calendar", () => {
    it("returns bounded scheduled items ordered by scheduledAt with safe DTOs", async () => {
      const base = editorialCalendarTestAnchor(30);
      const rangeStart = new Date(base.getTime() - 60 * 60 * 1000);
      const early = new Date(base.getTime() + 60 * 60 * 1000);
      const late = new Date(base.getTime() + 2 * 60 * 60 * 1000);
      const rangeEnd = new Date(base.getTime() + 3 * 60 * 60 * 1000);
      const outside = new Date(base.getTime() + 5 * 60 * 60 * 1000);

      const lateItem = await createScheduled("Calendar late", late);
      const earlyItem = await createScheduled("Calendar early", early);
      const outsideItem = await createScheduled("Calendar outside", outside);

      const calendar = await listEditorCalendarItems(
        { scopedCategoryIds: null },
        { start: rangeStart, end: rangeEnd },
        base,
      );

      assert.deepEqual(
        calendar.items.map((item) => item.contentItemId),
        [earlyItem.contentItemId, lateItem.contentItemId],
      );
      assert.equal(
        calendar.items.some((item) => item.contentItemId === outsideItem.contentItemId),
        false,
      );
      assert.equal(calendar.summary.scheduled, 2);
      assert.equal(calendar.summary.today, 2);
      assert.equal(calendar.summary.thisWeek, 2);

      const serialized = JSON.stringify(calendar.items[0]);
      assert.equal(serialized.includes("body"), false);
      assert.equal(serialized.includes("Calendar early"), true);
      assert.equal(calendar.items[0]?.scheduledVersionId, earlyItem.versionId);
      assert.equal(calendar.items[0]?.publicationStatus, PUBLICATION_STATUS.NEVER_PUBLISHED);
      assert.equal(calendar.items[0]?.workflowStatus, WORKFLOW_STATUS.APPROVED);
    });

    it("applies scheduled-version category scope and category filters", async () => {
      const base = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      const rangeStart = new Date(base.getTime() - 60 * 60 * 1000);
      const rangeEnd = new Date(base.getTime() + 24 * 60 * 60 * 1000);
      const a = await createScheduled("Calendar A", base, {
        categoryId: fixture.ids.categoryA,
      });
      const b = await createScheduled(
        "Calendar B",
        new Date(base.getTime() + 60 * 60 * 1000),
        { categoryId: fixture.ids.categoryB },
      );

      const selectedA = await listEditorCalendarItems(
        { scopedCategoryIds: scopedCategoryIdsForQuery(fixture.selectedOnA) },
        { start: rangeStart, end: rangeEnd },
        rangeStart,
      );
      assert.deepEqual(
        selectedA.items.map((item) => item.contentItemId),
        [a.contentItemId],
      );

      const selectedAFilterB = await listEditorCalendarItems(
        { scopedCategoryIds: scopedCategoryIdsForQuery(fixture.selectedOnA) },
        { start: rangeStart, end: rangeEnd, categoryId: fixture.ids.categoryB },
        rangeStart,
      );
      assert.deepEqual(selectedAFilterB.items, []);

      const selectedB = await listEditorCalendarItems(
        { scopedCategoryIds: scopedCategoryIdsForQuery(fixture.selectedOnB) },
        { start: rangeStart, end: rangeEnd },
        rangeStart,
      );
      assert.deepEqual(
        selectedB.items.map((item) => item.contentItemId),
        [b.contentItemId],
      );

      const emptyScope = await listEditorCalendarItems(
        { scopedCategoryIds: [] },
        { start: rangeStart, end: rangeEnd },
        rangeStart,
      );
      assert.deepEqual(emptyScope.items, []);
    });

    it("applies author and contentKind filters", async () => {
      const base = new Date(Date.now() + 32 * 24 * 60 * 60 * 1000);
      const rangeStart = new Date(base.getTime() - 60 * 60 * 1000);
      const rangeEnd = new Date(base.getTime() + 24 * 60 * 60 * 1000);
      const article = await createScheduled("Calendar article", base, {
        authorId: fixture.ids.author,
        contentKind: CONTENT_KIND.ARTICLE,
      });
      const gallery = await createScheduled(
        "Calendar gallery",
        new Date(base.getTime() + 60 * 60 * 1000),
        {
          authorId: fixture.ids.extraAuthor,
          contentKind: CONTENT_KIND.GALLERY,
        },
      );

      const byAuthor = await listEditorCalendarItems(
        { scopedCategoryIds: null },
        { start: rangeStart, end: rangeEnd, authorId: fixture.ids.extraAuthor },
        rangeStart,
      );
      assert.deepEqual(
        byAuthor.items.map((item) => item.contentItemId),
        [gallery.contentItemId],
      );
      assert.equal(byAuthor.items[0]?.authors[0]?.id, fixture.ids.extraAuthor);

      const byKind = await listEditorCalendarItems(
        { scopedCategoryIds: null },
        { start: rangeStart, end: rangeEnd, contentKind: CONTENT_KIND.ARTICLE },
        rangeStart,
      );
      assert.deepEqual(
        byKind.items.map((item) => item.contentItemId),
        [article.contentItemId],
      );
    });
  });

  describe("article editor model", () => {
    it("falls back to the scheduled version after scheduling clears the draft pointer", async () => {
      const created = await createDraftItem(fixture, {
        scope: fixture.superAdmin,
        includeRelations: true,
      });
      const submitted = await submitCurrent(
        created.contentItemId,
        created.versionId,
        created.updatedAt,
      );
      await approveCurrent(
        created.contentItemId,
        created.versionId,
        submitted.updatedAt,
      );
      const scheduled = await scheduleVersion(
        created.contentItemId,
        created.versionId,
        new Date(Date.now() + 60_000),
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      );

      assert.equal(scheduled.draftVersionId, null);
      assert.equal(scheduled.scheduledVersionId, created.versionId);

      const model = await getArticleEditorModel(created.contentItemId);
      assert.equal(model?.contentItem.draftVersionId, null);
      assert.equal(model?.editableVersion?.id, created.versionId);
      assert.equal(model?.editableVersion?.canEdit, false);
      assert.equal(model?.editableVersion?.workflowStatus, WORKFLOW_STATUS.APPROVED);
      assert.equal(model?.scheduledVersion?.id, created.versionId);
      assert.equal(model?.displayVersionId, created.versionId);
    });
  });
});

function editorialCalendarTestAnchor(daysAhead: number): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysAhead);
  date.setUTCHours(9, 0, 0, 0);
  return date;
}
