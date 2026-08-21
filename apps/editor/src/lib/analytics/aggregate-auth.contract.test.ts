import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_AGGREGATION_RUNNER_ERROR,
  AnalyticsAggregationRunnerError,
  assertAnalyticsAggregationAuthorized,
} from "./aggregate-runner";
import {
  SCHEDULED_PUBLISH_RUNNER_ERROR,
  assertScheduledPublishRunnerAuthorized,
} from "@/lib/content/scheduled-publish-runner";

const ANALYTICS_SECRET = "analytics-aggregation-secret-32-chars!!";
const SCHEDULE_SECRET = "scheduled-publish-runner-secret-32ch!!";

function requestWithBearer(secret: string): Request {
  return new Request("http://editor.test/api/internal/analytics/aggregate", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("analytics aggregation auth isolation", () => {
  it("accepts the dedicated analytics secret", () => {
    assert.doesNotThrow(() =>
      assertAnalyticsAggregationAuthorized(requestWithBearer(ANALYTICS_SECRET), ANALYTICS_SECRET),
    );
  });

  it("rejects a missing or wrong analytics secret", () => {
    assert.throws(
      () => assertAnalyticsAggregationAuthorized(requestWithBearer(""), ANALYTICS_SECRET),
      AnalyticsAggregationRunnerError,
    );
    assert.throws(
      () =>
        assertAnalyticsAggregationAuthorized(
          requestWithBearer("wrong-analytics-aggregation-secret-32"),
          ANALYTICS_SECRET,
        ),
      (error: unknown) =>
        error instanceof AnalyticsAggregationRunnerError &&
        error.code === ANALYTICS_AGGREGATION_RUNNER_ERROR.UNAUTHORIZED &&
        error.status === 401,
    );
  });

  it("does not accept the scheduled-publish secret for analytics aggregation", () => {
    assert.throws(
      () =>
        assertAnalyticsAggregationAuthorized(
          requestWithBearer(SCHEDULE_SECRET),
          ANALYTICS_SECRET,
        ),
      AnalyticsAggregationRunnerError,
    );
  });

  it("does not accept the analytics secret for scheduled publishing", () => {
    assert.throws(
      () =>
        assertScheduledPublishRunnerAuthorized(
          requestWithBearer(ANALYTICS_SECRET),
          SCHEDULE_SECRET,
        ),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === SCHEDULED_PUBLISH_RUNNER_ERROR.UNAUTHORIZED,
    );
  });
});
