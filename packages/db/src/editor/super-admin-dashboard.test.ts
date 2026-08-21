import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  assertSafeSuperAdminDashboardDto,
  buildUnavailableSection,
  defaultDashboardAnalyticsPeriod,
  type SuperAdminDashboardDto,
} from "./super-admin-dashboard";

function sampleDashboard(): SuperAdminDashboardDto {
  return {
    generatedAt: "2026-08-22T09:00:00.000Z",
    editorial: {
      status: "AVAILABLE",
      data: {
        draft: 1,
        inReview: 2,
        approved: 3,
        changesRequested: 4,
        scheduled: 5,
        published: 6,
      },
    },
    attention: { status: "AVAILABLE", data: { limit: 10, total: 0, items: [] } },
    upcomingPublishing: { status: "AVAILABLE", data: { limit: 8, items: [] } },
    review: {
      status: "AVAILABLE",
      data: {
        count: 0,
        changesRequested: 0,
        items: [],
        targetHref: "/review",
      },
    },
    analytics: {
      status: "AVAILABLE",
      data: {
        period: {
          fromInclusive: "2026-08-15T21:00:00.000Z",
          toExclusive: "2026-08-22T21:00:00.000Z",
          granularity: "DAY",
          timezone: "Europe/Istanbul",
        },
        freshness: { status: "UNAVAILABLE", reason: "AGGREGATION_PENDING" },
        metricAvailability: {
          ARTICLE_VIEWS: { status: "UNAVAILABLE" },
        },
        metrics: {
          articleViews: 0,
          homepageImpressions: 0,
          homepageClicks: 0,
          homepageCtr: null,
        },
        comparison: null,
      },
    },
    legal: {
      status: "AVAILABLE",
      data: {
        activeHolds: 0,
        activeTakedowns: 0,
        activeRetractions: 0,
        corrections: 0,
        recentActions: [],
        activeHoldItems: [],
      },
    },
    staffSecurity: {
      status: "AVAILABLE",
      data: {
        total: 1,
        active: 1,
        disabled: 0,
        superAdmin: 1,
        mfaConfigured: 1,
        mfaNotConfigured: 0,
      },
    },
    homepage: {
      status: "AVAILABLE",
      data: {
        liveVersionId: null,
        lastPublishedAt: null,
        unpublishedDraftExists: false,
        publishedSlotCount: 0,
        draftSlotCount: 0,
      },
    },
    seo: {
      status: "AVAILABLE",
      data: {
        accessibleCount: 0,
        errorCount: 0,
        warningCount: 0,
        missingMetaDescriptionCount: 0,
        missingHeroCount: 0,
        notIndexableCount: 0,
        healthyPublishedCount: 0,
        measurements: {},
      },
    },
    systemSignals: {
      status: "AVAILABLE",
      data: {
        publicCacheOutbox: {
          pending: 0,
          processing: 0,
          completed: 0,
          dead: 0,
          failed: 0,
        },
        analyticsFreshness: { status: "UNAVAILABLE" },
      },
    },
  };
}

describe("Super Admin dashboard read model contracts", () => {
  it("keeps partial failures explicit instead of converting them to zero data", () => {
    assert.deepEqual(buildUnavailableSection(), {
      status: "UNAVAILABLE",
      reason: "SOURCE_UNAVAILABLE",
    });
  });

  it("derives the default analytics window as the last seven Istanbul reporting days", () => {
    const period = defaultDashboardAnalyticsPeriod(
      new Date("2026-08-22T09:00:00.000Z"),
    );
    assert.equal(period.granularity, "DAY");
    assert.equal(period.fromInclusive.toISOString(), "2026-08-15T21:00:00.000Z");
    assert.equal(period.toExclusive.toISOString(), "2026-08-22T21:00:00.000Z");
  });

  it("accepts the bounded dashboard DTO shape", () => {
    assert.doesNotThrow(() => assertSafeSuperAdminDashboardDto(sampleDashboard()));
  });

  it("rejects sensitive fields anywhere in the dashboard DTO", () => {
    const dashboard = sampleDashboard() as unknown as Record<string, unknown>;
    dashboard.analytics = {
      status: "AVAILABLE",
      data: {
        metrics: { articleViews: 1 },
        eventId: "raw-event-id",
      },
    };
    assert.throws(
      () => assertSafeSuperAdminDashboardDto(dashboard),
      /forbidden key/i,
    );
  });

  it("counts review changesRequested independently of the IN_REVIEW queue", () => {
    const source = readFileSync(new URL("./super-admin-dashboard.ts", import.meta.url), "utf8");
    const fn = source.slice(
      source.indexOf("async function loadReviewSummary"),
      source.indexOf("async function loadAnalyticsSummary"),
    );
    assert.match(fn, /changesRequestedOnDraftSql/);
    assert.ok(fn.indexOf("changesRequestedOnDraftSql") > fn.indexOf("WORKFLOW_STATUS.IN_REVIEW"));
  });

  it("aliases outbox failed to DEAD because the outbox model has no FAILED status", () => {
    const source = readFileSync(new URL("./super-admin-dashboard.ts", import.meta.url), "utf8");
    const fn = source.slice(source.indexOf("async function loadSystemSignals"));
    assert.match(fn, /dead: outbox\.DEAD/);
    assert.match(fn, /failed: outbox\.DEAD/);
    assert.equal(fn.includes("outbox.FAILED"), false);
  });
});
