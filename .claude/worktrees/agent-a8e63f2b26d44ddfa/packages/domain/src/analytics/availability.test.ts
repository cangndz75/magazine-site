import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_METRIC_AVAILABILITY_REASON,
  ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY,
  resolveAnalyticsMetricAvailability,
} from "./reporting";

describe("analytics metric availability", () => {
  it("keeps a true zero available when aggregation is healthy", () => {
    assert.deepEqual(
      resolveAnalyticsMetricAvailability({
        measurement: ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY.ARTICLE_VIEWS,
        freshness: {
          status: "AVAILABLE",
          lastSuccessfulThrough: new Date("2026-08-21T12:00:00.000Z"),
          lastCompletedAt: new Date("2026-08-21T12:05:00.000Z"),
        },
      }),
      { status: "AVAILABLE" },
    );
  });

  it("marks instrumented metrics unavailable while aggregation is pending", () => {
    assert.deepEqual(
      resolveAnalyticsMetricAvailability({
        measurement: ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY.HOMEPAGE_IMPRESSIONS,
        freshness: {
          status: "UNAVAILABLE",
          reason: "AGGREGATION_PENDING",
          lastSuccessfulThrough: null,
          lastErrorSafeSummary: null,
        },
      }),
      {
        status: "UNAVAILABLE",
        reason: ANALYTICS_METRIC_AVAILABILITY_REASON.AGGREGATION_PENDING,
      },
    );
  });

  it("does not present sessions, unique visitors, or video plays as measured zeros", () => {
    assert.deepEqual(ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY.SESSIONS, {
      status: "UNAVAILABLE",
      reason: ANALYTICS_METRIC_AVAILABILITY_REASON.CONSENT_INTEGRATION_PENDING,
    });
    assert.deepEqual(ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY.UNIQUE_VISITORS, {
      status: "UNAVAILABLE",
      reason: ANALYTICS_METRIC_AVAILABILITY_REASON.DURABLE_VISITOR_ID_DISABLED,
    });
    assert.deepEqual(ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY.VIDEO_PLAYS, {
      status: "UNAVAILABLE",
      reason: ANALYTICS_METRIC_AVAILABILITY_REASON.VIDEO_PLAY_DEFERRED,
    });
  });
});
