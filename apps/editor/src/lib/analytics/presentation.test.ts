import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANALYTICS_REPORTING_METRIC } from "@magazine/domain";
import {
  ANALYTICS_CHART_METRICS,
  formatAnalyticsCount,
  formatAnalyticsCtr,
  formatAnalyticsDelta,
  isAnomalousCtr,
  isEditorialPlacement,
  presentAnalyticsFreshness,
  presentMetricAvailability,
} from "./presentation";

describe("analytics dashboard presentation", () => {
  it("renders zero-impression CTR as an em dash, not 0%", () => {
    assert.equal(formatAnalyticsCtr(null), "—");
    assert.equal(formatAnalyticsCtr(0), "%0,0");
  });

  it("does not clamp CTR above 100% and flags it as anomalous", () => {
    assert.equal(formatAnalyticsCtr(2), "%200,0");
    assert.equal(isAnomalousCtr(2), true);
    assert.equal(isAnomalousCtr(1), false);
    assert.equal(isAnomalousCtr(null), false);
  });

  it("distinguishes AVAILABLE+0 from UNAVAILABLE freshness states", () => {
    const available = presentAnalyticsFreshness({
      status: "AVAILABLE",
      lastSuccessfulThrough: new Date("2026-08-21T10:00:00.000Z").toISOString(),
      lastCompletedAt: new Date("2026-08-21T10:00:00.000Z").toISOString(),
    });
    assert.equal(available.tone, "ok");
    assert.match(available.label, /^Son güncelleme:/);

    const pending = presentAnalyticsFreshness({
      status: "UNAVAILABLE",
      reason: "AGGREGATION_PENDING",
      lastSuccessfulThrough: null,
      lastErrorSafeSummary: null,
    });
    assert.equal(pending.tone, "pending");
    assert.equal(pending.label, "Veriler hazırlanıyor.");

    const failed = presentAnalyticsFreshness({
      status: "UNAVAILABLE",
      reason: "AGGREGATION_FAILED",
      lastSuccessfulThrough: null,
      lastErrorSafeSummary: "safe summary",
    });
    assert.equal(failed.tone, "failed");
    assert.equal(failed.label, "Rapor verileri şu anda hazırlanamadı.");
  });

  it("never confuses an unavailable metric with a measured zero", () => {
    assert.equal(presentMetricAvailability({ status: "AVAILABLE" }), null);
    assert.equal(
      presentMetricAvailability({ status: "UNAVAILABLE", reason: "CONSENT_INTEGRATION_PENDING" }),
      "Onay entegrasyonu tamamlanana kadar bu ölçüm etkin değil.",
    );
    assert.equal(
      presentMetricAvailability({ status: "UNAVAILABLE", reason: "VIDEO_PLAY_DEFERRED" }),
      "Video oynatma ölçümü henüz devrede değil.",
    );
  });

  it("does not show Infinity or invented significance for period comparisons", () => {
    assert.equal(formatAnalyticsDelta(null), null);
    assert.deepEqual(formatAnalyticsDelta({ delta: 5, percentageChange: null }), {
      label: "Yeni",
      direction: "new",
    });
    assert.deepEqual(formatAnalyticsDelta({ delta: 0, percentageChange: null }), {
      label: "—",
      direction: "flat",
    });
    assert.deepEqual(formatAnalyticsDelta({ delta: 10, percentageChange: 0.5 }), {
      label: "+%50,0",
      direction: "up",
    });
    assert.deepEqual(formatAnalyticsDelta({ delta: -10, percentageChange: -0.25 }), {
      label: "-%25,0",
      direction: "down",
    });
  });

  it("excludes unmeasurable and non-selectable metrics from the chart selector", () => {
    assert.equal(
      ANALYTICS_CHART_METRICS.includes("SESSIONS" as never),
      false,
    );
    assert.equal(
      ANALYTICS_CHART_METRICS.includes("VIDEO_PLAYS" as never),
      false,
    );
    assert.equal(
      ANALYTICS_CHART_METRICS.includes("UNIQUE_VISITORS" as never),
      false,
    );
    assert.equal(
      ANALYTICS_CHART_METRICS.includes(ANALYTICS_REPORTING_METRIC.HOMEPAGE_CTR),
      false,
    );
    assert.equal(
      ANALYTICS_CHART_METRICS.includes(ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS),
      true,
    );
  });

  it("formats large counts with locale grouping", () => {
    assert.equal(formatAnalyticsCount(12345), "12.345");
  });

  it("only treats RECENCY_FALLBACK as non-editorial", () => {
    assert.equal(isEditorialPlacement("LEAD"), true);
    assert.equal(isEditorialPlacement("FEATURED_3"), true);
    assert.equal(isEditorialPlacement("CONVERSATION"), true);
    assert.equal(isEditorialPlacement("RECENCY_FALLBACK"), false);
  });
});
