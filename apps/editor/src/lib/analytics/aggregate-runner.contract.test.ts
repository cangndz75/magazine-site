import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const route = readFileSync(
  path.join(
    fileURLToPath(new URL("../../app/api/internal/analytics/aggregate/route.ts", import.meta.url)),
  ),
  "utf8",
);

describe("analytics aggregate runner contract", () => {
  it("uses a dedicated aggregation secret and does not expose a public dashboard", () => {
    assert.equal(route.includes("assertAnalyticsAggregationAuthorized"), true);
    assert.equal(route.includes("ANALYTICS_AGGREGATION_SECRET"), true);
    assert.equal(route.includes("assertScheduledPublishRunnerAuthorized"), false);
    assert.equal(route.includes("SCHEDULED_PUBLISH_RUNNER_SECRET"), false);
    assert.equal(route.includes("aggregateAnalyticsWindow"), true);
    assert.equal(route.includes("CAPABILITY.ANALYTICS_READ"), false);
  });
});
