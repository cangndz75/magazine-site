import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  AUTHOR_ROLE,
  SCHEDULED_PUBLISH_DECISION,
} from "@magazine/domain";
import {
  PUBLIC_CACHE_OUTBOX_EVENT_TYPE,
  PUBLIC_CACHE_OUTBOX_LOCK_TIMEOUT_MS,
  PUBLIC_CACHE_OUTBOX_MAX_ATTEMPTS,
  PUBLIC_CACHE_OUTBOX_STATUS,
  claimPublicCacheOutboxEvents,
  countPublicCacheOutboxEventsByStatus,
  markPublicCacheOutboxEventCompleted,
  markPublicCacheOutboxEventFailed,
  type PublicCacheOutboxEvent,
} from "../public-cache-outbox";
import {
  approveVersion,
  createDraftRevision,
  executeScheduledPublish,
  publishVersion,
  scheduleVersion,
  submitForReview,
  unpublishContent,
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
  type IntegrationFixture,
} from "./harness";

describe("public cache outbox PostgreSQL", () => {
  let fixture: IntegrationFixture;

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    fixture = await createFixture();
    await getRacerPool().query("DELETE FROM public_cache_outbox");
  });

  afterEach(async () => {
    const itemIds = fixture.createdItemIds.slice();
    await cleanupFixture(fixture);
    const leftover = await countLeftoverFixtures(itemIds);
    assert.equal(leftover.items, 0);
    assert.equal(leftover.versions, 0);
    assert.equal(leftover.reviewEvents, 0);
    assert.equal(leftover.auditEvents, 0);
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

  async function createApproved(title: string) {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title,
      body: articleBody(title),
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
    return created;
  }

  async function publishApproved(title = "Outbox live") {
    const created = await createApproved(title);
    await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    return created;
  }

  async function outboxRows(contentItemId: string) {
    const result = await getRacerPool().query<{
      id: string;
      event_type: string;
      payload: {
        schemaVersion: number;
        contentItemId: string;
        slug: string;
        body?: unknown;
      };
      status: string;
      attempt_count: number;
      locked_at: Date | null;
      next_attempt_at: Date;
      completed_at: Date | null;
      last_error: string | null;
    }>(
      `SELECT id, event_type, payload, status, attempt_count, locked_at, next_attempt_at, completed_at, last_error
       FROM public_cache_outbox
       WHERE (payload->>'contentItemId')::uuid = $1
       ORDER BY created_at, id`,
      [contentItemId],
    );
    return result.rows;
  }

  function articleOutboxContentItemId(
    payload: PublicCacheOutboxEvent["payload"],
  ): string {
    assert.equal("contentItemId" in payload, true);
    if (!("contentItemId" in payload)) {
      throw new Error("expected article cache payload");
    }
    return payload.contentItemId;
  }

  async function claimArticleOutboxEvent(): Promise<PublicCacheOutboxEvent> {
    let articleEvent: PublicCacheOutboxEvent | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const claimed = await claimPublicCacheOutboxEvents({ limit: 1 });
      if (claimed.length === 0) {
        break;
      }
      const current = claimed[0]!;
      if (
        current.eventType ===
        PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ARTICLE_CACHE_INVALIDATE
      ) {
        articleEvent = current;
        break;
      }
      assert.equal(await markPublicCacheOutboxEventCompleted(current), true);
    }
    assert.ok(articleEvent);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const claimed = await claimPublicCacheOutboxEvents({ limit: 5 });
      if (claimed.length === 0) {
        break;
      }
      for (const event of claimed) {
        if (
          event.eventType !==
          PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ARTICLE_CACHE_INVALIDATE
        ) {
          assert.equal(await markPublicCacheOutboxEventCompleted(event), true);
        }
      }
    }

    return articleEvent;
  }

  it("commits an outbox event with publish and without body payload", async () => {
    const created = await publishApproved();
    const rows = await outboxRows(created.contentItemId);

    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.event_type, "PUBLIC_ARTICLE_CACHE_INVALIDATE");
    assert.equal(rows[0]?.payload.schemaVersion, 1);
    assert.equal(rows[0]?.payload.contentItemId, created.contentItemId);
    assert.equal(rows[0]?.payload.slug, created.slug);
    assert.equal("body" in (rows[0]?.payload ?? {}), false);
    assert.equal(JSON.stringify(rows[0]?.payload).includes("blocks"), false);
  });

  it("commits outbox events for unpublish and scheduled publish", async () => {
    const created = await publishApproved("Scheduled source");
    await unpublishContent(
      created.contentItemId,
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
      title: "Scheduled V2",
      body: articleBody("scheduled-v2"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
      authors: [
        {
          authorId: fixture.ids.author,
          role: AUTHOR_ROLE.AUTHOR,
          sortOrder: 0,
        },
      ],
    });
    const submitted = await submitForReview(
      created.contentItemId,
      revision.versionId,
      {
        expectedUpdatedAt: saved.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(created.contentItemId, revision.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    const now = new Date();
    const scheduled = await scheduleVersion(
      created.contentItemId,
      revision.versionId,
      new Date(now.getTime() + 1000),
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
      now,
    );
    const executed = await executeScheduledPublish(
      created.contentItemId,
      scheduled.scheduleGeneration,
      new Date(now.getTime() + 2000),
    );

    assert.equal(executed.outcome, SCHEDULED_PUBLISH_DECISION.EXECUTE);
    const rows = await outboxRows(created.contentItemId);
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.payload.slug),
      [created.slug, created.slug, created.slug],
    );
  });

  it("does not commit an outbox event when publication fails", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Draft only",
    });

    await assert.rejects(() =>
      publishVersion(
        created.contentItemId,
        created.versionId,
        fixture.superAdmin,
        fixture.ids.staffReviewerA,
      ),
    );
    assert.deepEqual(await outboxRows(created.contentItemId), []);
  });

  it("commits entity related invalidation alongside article publish", async () => {
    const created = await publishApproved("Entity related cache");
    const result = await getRacerPool().query<{ event_type: string }>(
      `SELECT event_type
       FROM public_cache_outbox
       ORDER BY created_at, id`,
    );
    assert.equal(
      result.rows.some(
        (row) =>
          row.event_type ===
          PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE,
      ),
      true,
    );
    assert.equal((await outboxRows(created.contentItemId)).length, 1);
  });

  it("claims, completes, retries, and dead-letters events durably", async () => {
    const created = await publishApproved("Worker lifecycle");
    const firstClaim = await claimArticleOutboxEvent();
    assert.equal(articleOutboxContentItemId(firstClaim.payload), created.contentItemId);

    const now = new Date();
    const retryStatus = await markPublicCacheOutboxEventFailed(
      firstClaim,
      new Error("cache unavailable"),
      now,
    );
    assert.equal(retryStatus, PUBLIC_CACHE_OUTBOX_STATUS.PENDING);
    assert.equal((await claimPublicCacheOutboxEvents({ limit: 1, now })).length, 0);

    const retry = await claimPublicCacheOutboxEvents({
      limit: 1,
      now: new Date(now.getTime() + 61_000),
    });
    assert.equal(retry.length, 1);
    assert.equal(await markPublicCacheOutboxEventCompleted(retry[0]!), true);

    let rows = await outboxRows(created.contentItemId);
    assert.equal(rows[0]?.status, PUBLIC_CACHE_OUTBOX_STATUS.COMPLETED);
    assert.equal(rows[0]?.completed_at instanceof Date, true);

    const poisonCreated = await publishApproved("Poison event");
    const poison = await claimArticleOutboxEvent();
    await getRacerPool().query(
      `UPDATE public_cache_outbox
       SET attempt_count = $1
       WHERE id = $2`,
      [PUBLIC_CACHE_OUTBOX_MAX_ATTEMPTS, poison.id],
    );
    const deadStatus = await markPublicCacheOutboxEventFailed(
      { ...poison, attemptCount: PUBLIC_CACHE_OUTBOX_MAX_ATTEMPTS },
      new Error("permanent"),
    );
    assert.equal(deadStatus, PUBLIC_CACHE_OUTBOX_STATUS.DEAD);
    rows = await outboxRows(poisonCreated.contentItemId);
    assert.equal(rows.some((row) => row.status === PUBLIC_CACHE_OUTBOX_STATUS.DEAD), true);
    assert.equal(rows.some((row) => row.last_error === "permanent"), true);
  });

  it("uses SKIP LOCKED style claiming and can reclaim stale processing rows", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: false,
      title: "Concurrency",
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
    await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    const [left, right] = await Promise.all([
      claimPublicCacheOutboxEvents({ limit: 1 }),
      claimPublicCacheOutboxEvents({ limit: 1 }),
    ]);
    assert.equal(left.length + right.length, 1);
    const claimed = (left[0] ?? right[0])!;
    assert.equal(
      (await claimPublicCacheOutboxEvents({ limit: 1 })).length,
      0,
    );

    const reclaimed = await claimPublicCacheOutboxEvents({
      limit: 1,
      now: new Date(Date.now() + PUBLIC_CACHE_OUTBOX_LOCK_TIMEOUT_MS + 1000),
    });
    assert.equal(reclaimed.length, 1);
    assert.equal(reclaimed[0]?.id, claimed.id);

    const counts = await countPublicCacheOutboxEventsByStatus();
    assert.equal(counts.PROCESSING, 1);
    assert.equal(
      (await outboxRows(created.contentItemId))[0]?.attempt_count,
      2,
    );

    assert.equal(
      await markPublicCacheOutboxEventCompleted(claimed),
      false,
    );
    assert.equal(
      (await outboxRows(created.contentItemId))[0]?.status,
      PUBLIC_CACHE_OUTBOX_STATUS.PROCESSING,
    );
    assert.equal(
      await markPublicCacheOutboxEventFailed(claimed, new Error("old attempt")),
      null,
    );
    let rows = await outboxRows(created.contentItemId);
    assert.equal(rows[0]?.status, PUBLIC_CACHE_OUTBOX_STATUS.PROCESSING);
    assert.equal(rows[0]?.attempt_count, 2);
    assert.equal(rows[0]?.last_error, null);

    assert.equal(await markPublicCacheOutboxEventCompleted(reclaimed[0]!), true);
    rows = await outboxRows(created.contentItemId);
    assert.equal(rows[0]?.status, PUBLIC_CACHE_OUTBOX_STATUS.COMPLETED);
    assert.equal(rows[0]?.completed_at instanceof Date, true);

    assert.equal(
      await markPublicCacheOutboxEventFailed(
        claimed,
        new Error("old attempt after completion"),
      ),
      null,
    );
    rows = await outboxRows(created.contentItemId);
    assert.equal(rows[0]?.status, PUBLIC_CACHE_OUTBOX_STATUS.COMPLETED);
    assert.equal(rows[0]?.last_error, null);

    const finalAttemptCreated = await publishApproved("Final stale processing");
    const finalAttempt = await claimArticleOutboxEvent();
    assert.equal(
      articleOutboxContentItemId(finalAttempt.payload),
      finalAttemptCreated.contentItemId,
    );

    await getRacerPool().query(
      `UPDATE public_cache_outbox
       SET attempt_count = $1, locked_at = $2
       WHERE id = $3`,
      [
        PUBLIC_CACHE_OUTBOX_MAX_ATTEMPTS,
        new Date(Date.now() - PUBLIC_CACHE_OUTBOX_LOCK_TIMEOUT_MS - 1000),
        finalAttempt.id,
      ],
    );
    assert.equal(
      (await claimPublicCacheOutboxEvents({ limit: 1 })).length,
      0,
    );
    assert.equal(
      (await outboxRows(finalAttemptCreated.contentItemId))[0]?.status,
      PUBLIC_CACHE_OUTBOX_STATUS.DEAD,
    );
  });
});
