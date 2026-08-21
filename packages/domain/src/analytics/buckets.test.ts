import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANALYTICS_REPORTING_TIMEZONE, ANALYTICS_TIME_BUCKET } from "./aggregation-policy";
import {
  enumerateUtcBuckets,
  reportingCalendarDate,
  reportingDayBucketStart,
  utcHourBucketStart,
  zonedLocalToUtc,
} from "./buckets";

describe("analytics reporting timezone", () => {
  it("uses IANA Europe/Istanbul midnight rather than UTC midnight or a hardcoded offset helper", () => {
    assert.equal(ANALYTICS_REPORTING_TIMEZONE, "Europe/Istanbul");
    const localDay = reportingDayBucketStart(new Date("2026-08-21T10:00:00.000Z"));
    assert.equal(localDay.toISOString(), "2026-08-20T21:00:00.000Z");
    assert.equal(
      zonedLocalToUtc(ANALYTICS_REPORTING_TIMEZONE, 2026, 8, 21).toISOString(),
      "2026-08-20T21:00:00.000Z",
    );
    assert.notEqual(localDay.toISOString(), "2026-08-21T00:00:00.000Z");
  });

  it("assigns events just before local midnight to the previous reporting day", () => {
    const before = new Date("2026-08-20T20:59:59.000Z");
    const atBoundary = new Date("2026-08-20T21:00:00.000Z");
    assert.equal(reportingCalendarDate(before), "2026-08-20");
    assert.equal(reportingDayBucketStart(before).toISOString(), "2026-08-19T21:00:00.000Z");
    assert.equal(reportingCalendarDate(atBoundary), "2026-08-21");
    assert.equal(reportingDayBucketStart(atBoundary).toISOString(), "2026-08-20T21:00:00.000Z");
  });

  it("keeps hourly buckets on UTC instants", () => {
    const occurredAt = new Date("2026-08-20T20:30:00.000Z");
    assert.equal(utcHourBucketStart(occurredAt).toISOString(), "2026-08-20T20:00:00.000Z");
    const hours = enumerateUtcBuckets({
      fromInclusive: new Date("2026-08-20T20:00:00.000Z"),
      toExclusive: new Date("2026-08-20T22:00:00.000Z"),
      granularity: ANALYTICS_TIME_BUCKET.HOUR,
    });
    assert.deepEqual(
      hours.map((bucket) => bucket.toISOString()),
      ["2026-08-20T20:00:00.000Z", "2026-08-20T21:00:00.000Z"],
    );
  });

  it("does not depend on the machine local timezone", () => {
    const previousTz = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      assert.equal(
        reportingDayBucketStart(new Date("2026-08-21T00:30:00.000Z")).toISOString(),
        "2026-08-20T21:00:00.000Z",
      );
    } finally {
      if (previousTz === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = previousTz;
      }
    }
  });
});
