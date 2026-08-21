import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANALYTICS_AGGREGATION_JOB_NAME } from "@magazine/domain";

describe("analytics aggregate job contract", () => {
  it("uses a stable advisory-lock job name", () => {
    assert.equal(ANALYTICS_AGGREGATION_JOB_NAME, "analytics.aggregate.v1");
  });
});
