import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  CONTENT_LEGAL_ACTION_POLARITY,
  CONTENT_LEGAL_ACTION_TYPE,
  CONTENT_LEGAL_ERROR,
  CONTENT_LEGAL_REASON_CATEGORY,
  ContentLegalError,
  PUBLICATION_STATUS,
  PUBLIC_ARTICLE_WITHDRAWAL_KIND,
  PUBLIC_LEGAL_NOTICE_KIND,
  PUBLISHING_ERROR,
  PublishingError,
  WORKFLOW_STATUS,
} from "@magazine/domain";
import { getDb } from "../client";
import { listContentAuditEvents } from "../editor";
import { getPublicArticleBySlug, getPublicArticlePageBySlug } from "../public";
import {
  approveVersion,
  listContentLegalActions,
  publishVersion,
  recordContentLegalAction,
  submitForReview,
  unpublishContent,
  updateDraftContent,
} from "../publishing";
import { contentItems, contentLegalActions, contentVersions } from "../schema/content";
import { publicCacheOutbox } from "../schema/outbox";
import { eq, sql } from "drizzle-orm";
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
  snapshotContent,
  type IntegrationFixture,
} from "./harness";

function assertLegalCode(error: unknown, code: string): void {
  assert.equal(error instanceof ContentLegalError, true, String(error));
  assert.equal((error as ContentLegalError).code, code);
}

function assertPublishingCode(error: unknown, code: string): void {
  assert.equal(error instanceof PublishingError, true, String(error));
  assert.equal((error as PublishingError).code, code);
}

describe("editorial legal actions PostgreSQL foundation", () => {
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
    assert.equal(leftover.auditEvents, 0);
    assert.equal(leftover.legalActions, 0);
    assert.equal(leftover.outboxEvents, 0);
  });

  after(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const leftoverTx = await countOpenTestTransactions();
    assert.equal(leftoverTx, 0, "integration tests leaked open transactions");
    await closeIntegrationConnections();
  });

  async function publishApproved(title = "Live legal article") {
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

  it("records a correction against a still-published article without rewriting publication history", async () => {
    const { created, published } = await publishApproved();
    const before = await snapshotContent(created.contentItemId, created.versionId);
    const beforeOutbox = await getDb()
      .select({ id: publicCacheOutbox.id })
      .from(publicCacheOutbox)
      .where(
        sql`(payload->>'contentItemId')::uuid = ${created.contentItemId}::uuid`,
      );

    const recorded = await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.FACTUAL_ERROR,
      internalNote: "The date in paragraph two was wrong.",
      publicNote: "We corrected the date of the incident.",
      expectedUpdatedAt: published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });

    assert.equal(recorded.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(recorded.publishedVersionId, created.versionId);
    assert.equal(recorded.publishedAt?.getTime(), published.publishedAt.getTime());
    assert.equal(recorded.action.actionType, CONTENT_LEGAL_ACTION_TYPE.CORRECTION);
    assert.equal(recorded.retractedAt, null);
    assert.equal(recorded.takedownAt, null);

    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(after.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(after.publishedVersionId, before.publishedVersionId);
    assert.equal(after.workflowStatus, WORKFLOW_STATUS.APPROVED);
    assert.equal(after.title, before.title);
    assert.deepEqual(after.body, before.body);

    const publicArticle = await getPublicArticleBySlug(created.slug);
    assert.equal(publicArticle?.title, "Live legal article");
    assert.equal(publicArticle?.legalNotices.length, 1);
    assert.equal(publicArticle?.legalNotices[0]?.kind, PUBLIC_LEGAL_NOTICE_KIND.CORRECTION);
    assert.equal(
      publicArticle?.legalNotices[0]?.publicNote,
      "We corrected the date of the incident.",
    );

    const outboxRows = await getDb()
      .select({ id: publicCacheOutbox.id })
      .from(publicCacheOutbox)
      .where(
        sql`(payload->>'contentItemId')::uuid = ${created.contentItemId}::uuid`,
      );
    assert.equal(outboxRows.length, beforeOutbox.length + 1);

    const history = await listContentLegalActions(created.contentItemId);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.internalNote, "The date in paragraph two was wrong.");
  });

  it("records a clarification that may coexist with a published article", async () => {
    const { created, published } = await publishApproved("Clarification piece");
    const recorded = await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.CLARIFICATION,
      internalNote: "Clarify that the quote was from a draft memo.",
      expectedUpdatedAt: published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    assert.equal(recorded.action.actionType, CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION);
    assert.equal(recorded.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    const clarificationArticle = await getPublicArticleBySlug(created.slug);
    assert.equal(clarificationArticle !== null, true);
    assert.equal(clarificationArticle?.legalNotices.length, 1);
    assert.equal(
      clarificationArticle?.legalNotices[0]?.kind,
      PUBLIC_LEGAL_NOTICE_KIND.CLARIFICATION,
    );
    const publicPage = await getPublicArticlePageBySlug(created.slug);
    assert.equal(publicPage?.status, "live");
    assert.equal(await getPublicArticleBySlug(created.slug) !== null, true);
  });

  it("models retraction as editorial withdrawal without deleting versions or changing publicationStatus", async () => {
    const { created, published } = await publishApproved("Retract me");
    const recorded = await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.EDITORIAL_STANDARDS,
      internalNote: "Core claim does not hold.",
      publicNote: "This article has been retracted.",
      expectedUpdatedAt: published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    assert.equal(recorded.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(recorded.publishedVersionId, created.versionId);
    assert.equal(recorded.retractedAt !== null, true);
    assert.equal(await getPublicArticleBySlug(created.slug), null);

    const withdrawnPage = await getPublicArticlePageBySlug(created.slug);
    assert.equal(withdrawnPage?.status, "withdrawn");
    if (withdrawnPage?.status !== "withdrawn") {
      throw new Error("expected withdrawn page");
    }
    assert.equal(withdrawnPage.shell.title, "Retract me");
    assert.equal(
      withdrawnPage.shell.withdrawalKind,
      PUBLIC_ARTICLE_WITHDRAWAL_KIND.RETRACTION,
    );
    assert.equal(withdrawnPage.shell.publicNote, "This article has been retracted.");
    assert.equal(JSON.stringify(withdrawnPage.shell).includes("internalNote"), false);

    const db = getDb();
    const [item] = await db
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, created.contentItemId))
      .limit(1);
    const [version] = await db
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.id, created.versionId))
      .limit(1);
    assert.equal(item?.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(version?.title, "Retract me");
  });

  it("models takedown separately from ordinary unpublish and preserves evidence", async () => {
    const { created, published } = await publishApproved("Take down");
    const recorded = await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
      internalNote: "Court order received.",
      expectedUpdatedAt: published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    assert.equal(recorded.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    assert.equal(recorded.takedownAt !== null, true);
    assert.equal(await getPublicArticleBySlug(created.slug), null);

    const takedownPage = await getPublicArticlePageBySlug(created.slug);
    assert.equal(takedownPage?.status, "withdrawn");
    if (takedownPage?.status !== "withdrawn") {
      throw new Error("expected withdrawn page");
    }
    assert.equal(takedownPage.shell.title, "Take down");
    assert.equal(
      takedownPage.shell.withdrawalKind,
      PUBLIC_ARTICLE_WITHDRAWAL_KIND.TAKEDOWN,
    );
    assert.equal(JSON.stringify(takedownPage.shell).includes("internalNote"), false);

    const unpublished = await publishApproved("Ordinary unpublish control");
    const withdrawn = await unpublishContent(
      unpublished.created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    assert.equal(withdrawn.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    const history = await listContentLegalActions(unpublished.created.contentItemId);
    assert.equal(history.length, 0);
  });

  it("places a legal hold that fail-closes editorial mutations and can be released", async () => {
    const { created, published } = await publishApproved("Held article");
    const held = await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD,
      polarity: CONTENT_LEGAL_ACTION_POLARITY.APPLY,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
      internalNote: "Preserve all versions pending counsel review.",
      expectedUpdatedAt: published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    assert.equal(held.legalHoldAt !== null, true);
    assert.equal(await getPublicArticleBySlug(created.slug) !== null, true);

    await assert.rejects(
      () =>
        unpublishContent(
          created.contentItemId,
          fixture.superAdmin,
          fixture.ids.staffReviewerA,
        ),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_LEGAL_HOLD);
        return true;
      },
    );

    const released = await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD,
      polarity: CONTENT_LEGAL_ACTION_POLARITY.RELEASE,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
      internalNote: "Counsel cleared the hold.",
      expectedUpdatedAt: held.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    assert.equal(released.legalHoldAt, null);

    const withdrawn = await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    assert.equal(withdrawn.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
  });

  it("denies legal mutations without CONTENT_LEGAL", async () => {
    const { created, published } = await publishApproved("Forbidden legal");
    await assert.rejects(
      () =>
        recordContentLegalAction({
          contentItemId: created.contentItemId,
          actionType: CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
          reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.FACTUAL_ERROR,
          internalNote: "Editor attempted a legal correction.",
          expectedUpdatedAt: published.updatedAt,
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
        }),
      (error: unknown) => {
        assertLegalCode(error, CONTENT_LEGAL_ERROR.FORBIDDEN);
        return true;
      },
    );
    const history = await listContentLegalActions(created.contentItemId);
    assert.equal(history.length, 0);
  });

  it("rejects a stale expectedUpdatedAt and preserves the first legal action", async () => {
    const { created, published } = await publishApproved("Stale legal");
    const first = await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.FACTUAL_ERROR,
      internalNote: "First correction note.",
      expectedUpdatedAt: published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await assert.rejects(
      () =>
        recordContentLegalAction({
          contentItemId: created.contentItemId,
          actionType: CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
          reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.CLARIFICATION,
          internalNote: "Stale second note.",
          expectedUpdatedAt: published.updatedAt,
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffReviewerA,
        }),
      (error: unknown) => {
        assertLegalCode(error, CONTENT_LEGAL_ERROR.CONTENT_WRITE_CONFLICT);
        return true;
      },
    );
    const history = await listContentLegalActions(created.contentItemId);
    assert.equal(history.length, 1);
    assert.equal(history[0]?.id, first.action.id);
    assert.equal(history[0]?.internalNote, "First correction note.");
  });

  it("keeps an immutable action history and does not hard-delete content", async () => {
    const { created, published } = await publishApproved("History article");
    const first = await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.FACTUAL_ERROR,
      internalNote: "First immutable note.",
      expectedUpdatedAt: published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.CLARIFICATION,
      internalNote: "Second immutable note.",
      expectedUpdatedAt: first.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    const history = await listContentLegalActions(created.contentItemId);
    assert.equal(history.length, 2);
    assert.equal(history[0]?.internalNote, "First immutable note.");
    assert.equal(history[1]?.internalNote, "Second immutable note.");

    const pool = getRacerPool();
    await assert.rejects(() =>
      pool.query("DELETE FROM content_items WHERE id = $1", [created.contentItemId]),
    );
    const db = getDb();
    const remainingActions = await db
      .select({ id: contentLegalActions.id })
      .from(contentLegalActions)
      .where(eq(contentLegalActions.contentItemId, created.contentItemId));
    const remainingVersions = await db
      .select({ id: contentVersions.id })
      .from(contentVersions)
      .where(eq(contentVersions.contentItemId, created.contentItemId));
    assert.equal(remainingActions.length, 2);
    assert.equal(remainingVersions.length, 1);

    const audit = await listContentAuditEvents(created.contentItemId, fixture.superAdmin, {
      limit: 50,
      cursor: null,
    });
    assert.equal(
      audit?.items.some(
        (event) => event.eventType === CONTENT_AUDIT_EVENT_TYPE.CONTENT_CORRECTION_RECORDED,
      ),
      true,
    );
    assert.equal(
      audit?.items.some(
        (event) =>
          event.eventType === CONTENT_AUDIT_EVENT_TYPE.CONTENT_CLARIFICATION_RECORDED,
      ),
      true,
    );
  });

  it("leaves ordinary publish and unpublish unchanged when no legal action exists", async () => {
    const { created, published } = await publishApproved("Normal control");
    assert.equal(published.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
    const liveArticle = await getPublicArticleBySlug(created.slug);
    assert.equal(liveArticle !== null, true);
    assert.deepEqual(liveArticle?.legalNotices, []);
    const withdrawn = await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    assert.equal(withdrawn.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
    assert.equal(await getPublicArticleBySlug(created.slug), null);
    assert.equal((await listContentLegalActions(created.contentItemId)).length, 0);
  });

  it("blocks draft mutation while a legal hold is active", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Draft hold",
    });
    const held = await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD,
      polarity: CONTENT_LEGAL_ACTION_POLARITY.APPLY,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.LEGAL_COMPLAINT,
      internalNote: "Hold the unpublished draft.",
      expectedUpdatedAt: created.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await assert.rejects(
      () =>
        updateDraftContent({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: held.updatedAt,
          title: "Mutated during hold",
          body: articleBody("should-not-save"),
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_LEGAL_HOLD);
        return true;
      },
    );
  });
});
