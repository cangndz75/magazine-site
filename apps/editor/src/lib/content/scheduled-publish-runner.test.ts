import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SCHEDULED_PUBLISH_DECISION } from "@magazine/domain";
import {
  SCHEDULED_PUBLISH_RUNNER_ERROR,
  ScheduledPublishRunnerError,
  assertScheduledPublishRunnerAuthorized,
  parseScheduledPublishJobPayload,
  runScheduledPublishJob,
} from "./scheduled-publish-runner";

const CONTENT_ITEM_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const SECRET = "12345678901234567890123456789012";

function requestWithAuthorization(value: string | null): Pick<Request, "headers"> {
  const headers = new Headers();
  if (value !== null) {
    headers.set("authorization", value);
  }
  return { headers };
}

describe("scheduled publish runner", () => {
  it("accepts only the bearer machine secret", () => {
    assert.doesNotThrow(() =>
      assertScheduledPublishRunnerAuthorized(
        requestWithAuthorization(`Bearer ${SECRET}`),
        SECRET,
      ),
    );

    for (const header of [null, SECRET, "Bearer wrong-secret"]) {
      assert.throws(
        () =>
          assertScheduledPublishRunnerAuthorized(
            requestWithAuthorization(header),
            SECRET,
          ),
        (error) =>
          error instanceof ScheduledPublishRunnerError &&
          error.code === SCHEDULED_PUBLISH_RUNNER_ERROR.UNAUTHORIZED &&
          error.status === 401,
      );
    }
  });

  it("requires contentItemId and scheduleGeneration in the job payload", () => {
    assert.deepEqual(
      parseScheduledPublishJobPayload({
        contentItemId: CONTENT_ITEM_ID,
        scheduleGeneration: 4,
      }),
      {
        contentItemId: CONTENT_ITEM_ID,
        scheduleGeneration: 4,
      },
    );

    for (const body of [
      {},
      { contentItemId: "not-a-uuid", scheduleGeneration: 4 },
      { contentItemId: CONTENT_ITEM_ID },
      { contentItemId: CONTENT_ITEM_ID, scheduleGeneration: -1 },
      { contentItemId: CONTENT_ITEM_ID, scheduleGeneration: 1.5 },
    ]) {
      assert.throws(
        () => parseScheduledPublishJobPayload(body),
        (error) =>
          error instanceof ScheduledPublishRunnerError &&
          error.code === SCHEDULED_PUBLISH_RUNNER_ERROR.INVALID_REQUEST &&
          error.status === 400,
      );
    }
  });

  it("invalidates public article cache only after successful scheduled execution", async () => {
    const invalidated: unknown[] = [];
    const result = await runScheduledPublishJob(
      { contentItemId: CONTENT_ITEM_ID, scheduleGeneration: 4 },
      {
        execute: async () => ({
          outcome: SCHEDULED_PUBLISH_DECISION.EXECUTE,
          publish: {
            contentItemId: CONTENT_ITEM_ID,
            slug: "kanonik-haber",
            publishedVersionId: VERSION_ID,
            publicationStatus: "PUBLISHED",
            publishedAt: new Date("2026-08-18T10:00:00.000Z"),
            publicDateModified: new Date("2026-08-18T10:00:00.000Z"),
            draftVersionId: null,
            scheduledVersionId: null,
            scheduledAt: null,
            scheduleGeneration: 5,
            updatedAt: new Date("2026-08-18T10:00:00.000Z"),
          },
        }),
        invalidate: async (target) => {
          invalidated.push(target);
        },
      },
    );

    assert.deepEqual(result, {
      outcome: SCHEDULED_PUBLISH_DECISION.EXECUTE,
      cacheInvalidated: true,
      contentItemId: CONTENT_ITEM_ID,
      slug: "kanonik-haber",
      publishedVersionId: VERSION_ID,
    });
    assert.equal(invalidated.length, 1);
  });

  it("does not invalidate for non-executed schedules", async () => {
    let invalidated = false;
    const result = await runScheduledPublishJob(
      { contentItemId: CONTENT_ITEM_ID, scheduleGeneration: 4 },
      {
        execute: async () => ({ outcome: SCHEDULED_PUBLISH_DECISION.NOOP_STALE }),
        invalidate: async () => {
          invalidated = true;
        },
      },
    );

    assert.deepEqual(result, {
      outcome: SCHEDULED_PUBLISH_DECISION.NOOP_STALE,
      cacheInvalidated: false,
    });
    assert.equal(invalidated, false);
  });

  it("does not roll back the runner success shape when invalidation logs internally", async () => {
    const result = await runScheduledPublishJob(
      { contentItemId: CONTENT_ITEM_ID, scheduleGeneration: 4 },
      {
        execute: async () => ({
          outcome: SCHEDULED_PUBLISH_DECISION.EXECUTE,
          publish: {
            contentItemId: CONTENT_ITEM_ID,
            slug: "kanonik-haber",
            publishedVersionId: VERSION_ID,
            publicationStatus: "PUBLISHED",
            publishedAt: new Date("2026-08-18T10:00:00.000Z"),
            publicDateModified: new Date("2026-08-18T10:00:00.000Z"),
            draftVersionId: null,
            scheduledVersionId: null,
            scheduledAt: null,
            scheduleGeneration: 5,
            updatedAt: new Date("2026-08-18T10:00:00.000Z"),
          },
        }),
        invalidate: async () => undefined,
      },
    );

    assert.equal(result.outcome, SCHEDULED_PUBLISH_DECISION.EXECUTE);
    assert.equal(result.cacheInvalidated, true);
  });
});
