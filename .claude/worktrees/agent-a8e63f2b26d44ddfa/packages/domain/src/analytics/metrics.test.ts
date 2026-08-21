import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ANALYTICS_ADS_BOUNDARY,
  ANALYTICS_MEASUREMENT_CLASS,
  ANALYTICS_METRIC_DEFINITIONS,
  ANALYTICS_RETENTION_POLICY,
  ANALYTICS_TRAFFIC_KIND,
  countAudienceEvents,
  homepageCtr,
  isDefaultAudienceTraffic,
  parseAnalyticsRawRetentionDays,
  uniqueAnonymousSessions,
} from "./index";

describe("analytics metric definitions", () => {
  it("excludes bot, internal, and test traffic from default audience counts", () => {
    const ids = ["a", "a", "b"];
    assert.equal(
      countAudienceEvents({ trafficKind: ANALYTICS_TRAFFIC_KIND.HUMAN, eventIds: ids }),
      2,
    );
    assert.equal(
      countAudienceEvents({ trafficKind: ANALYTICS_TRAFFIC_KIND.BOT, eventIds: ids }),
      0,
    );
    assert.equal(
      countAudienceEvents({ trafficKind: ANALYTICS_TRAFFIC_KIND.INTERNAL, eventIds: ids }),
      0,
    );
    assert.equal(
      countAudienceEvents({ trafficKind: ANALYTICS_TRAFFIC_KIND.TEST, eventIds: ids }),
      0,
    );
    assert.equal(
      isDefaultAudienceTraffic({ trafficKind: ANALYTICS_TRAFFIC_KIND.HUMAN }),
      true,
    );
    assert.equal(
      isDefaultAudienceTraffic({ trafficKind: ANALYTICS_TRAFFIC_KIND.BOT }),
      false,
    );
  });

  it("defines CTR zero-denominator as null, not zero", () => {
    assert.equal(homepageCtr(0, 0), null);
    assert.equal(homepageCtr(4, 0), null);
    assert.equal(homepageCtr(1, 4), 0.25);
    assert.equal(ANALYTICS_METRIC_DEFINITIONS.HOMEPAGE_CTR.includes("null"), true);
  });

  it("treats sessions as anonymous identifiers, not unique people", () => {
    assert.equal(
      uniqueAnonymousSessions(["s1", null, "s1", "s2", undefined]),
      2,
    );
    assert.equal(
      ANALYTICS_METRIC_DEFINITIONS.UNIQUE_VISITORS.includes("unique people"),
      true,
    );
    assert.equal(ANALYTICS_ADS_BOUNDARY.CURRENT_CLASS, ANALYTICS_MEASUREMENT_CLASS.EDITORIAL);
    assert.equal(ANALYTICS_ADS_BOUNDARY.BILLABLE_AD_MEASUREMENT, false);
    assert.equal(parseAnalyticsRawRetentionDays(undefined), ANALYTICS_RETENTION_POLICY.DEFAULT_RAW_DAYS);
    assert.equal(parseAnalyticsRawRetentionDays(30), 30);
    assert.equal(parseAnalyticsRawRetentionDays(3), ANALYTICS_RETENTION_POLICY.DEFAULT_RAW_DAYS);
  });
});
