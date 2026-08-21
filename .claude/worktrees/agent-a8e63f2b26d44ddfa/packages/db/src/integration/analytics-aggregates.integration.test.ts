import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
  ANALYTICS_APP_ENV,
  ANALYTICS_CONSENT_STATE,
  ANALYTICS_CONTENT_SORT,
  ANALYTICS_EVENT_NAME,
  ANALYTICS_METRIC_AVAILABILITY_REASON,
  ANALYTICS_PLACEMENT,
  ANALYTICS_REPORTING_METRIC,
  ANALYTICS_SURFACE,
  ANALYTICS_TAXONOMY_VERSION,
  ANALYTICS_TIME_BUCKET,
  CONTENT_LEGAL_ACTION_TYPE,
  CONTENT_LEGAL_REASON_CATEGORY,
  HOMEPAGE_SLOT_KEY,
  signAnalyticsContext,
} from "@magazine/domain";
import {
  aggregateAnalyticsWindow,
  getAnalyticsAuthors,
  getAnalyticsCategories,
  getAnalyticsContentPerformance,
  getAnalyticsHomepageSlots,
  getAnalyticsOverview,
  getAnalyticsSources,
  getAnalyticsTimeSeries,
  ingestPublicAnalyticsEvent,
} from "../analytics";
import { getDb } from "../client";
import { getHomepageBuilder, publishHomepage, setHomepageSlot } from "../editor";
import { getPublicHomepage } from "../public";
import {
  approveVersion,
  createDraftRevision,
  publishVersion,
  recordContentLegalAction,
  submitForReview,
  updateContentSlug,
} from "../publishing";
import { analyticsContentDaily } from "../schema/analytics-aggregates";
import {
  articleBody,
  cleanupFixture,
  closeIntegrationConnections,
  countLeftoverFixtures,
  countOpenTestTransactions,
  createDraftItem,
  createFixture,
  ensureEditorContentTestDatabase,
  type IntegrationFixture,
} from "./harness";

const SITE_URL = "https://www.example.com";
const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";
const SIGNING_KEY = "test-analytics-context-signing-key-32";
const ISTANBUL_AUG_21 = {
  fromInclusive: new Date("2026-08-20T21:00:00.000Z"),
  toExclusive: new Date("2026-08-21T21:00:00.000Z"),
  granularity: ANALYTICS_TIME_BUCKET.DAY,
};
const AGGREGATE_AUG_21 = {
  from: new Date("2026-08-20T21:00:00.000Z"),
  to: new Date("2026-08-21T21:00:00.000Z"),
};

function ingestContext(overrides: {
  receivedAt?: Date;
  referrerUrl?: string | null;
  trafficSignals?: {
    userAgent?: string;
    trustedInternalEvidence?: boolean;
    trustedTestEvidence?: boolean;
  };
} = {}) {
  return {
    receivedAt: overrides.receivedAt ?? new Date("2026-08-21T18:00:10.000Z"),
    appEnv: ANALYTICS_APP_ENV.PRODUCTION,
    consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
    trustedSiteOrigin: SITE_URL,
    referrerUrl: overrides.referrerUrl === undefined ? "https://www.google.com/search?q=x" : overrides.referrerUrl,
    trafficSignals: overrides.trafficSignals ?? {},
    analyticsContextSigningKey: SIGNING_KEY,
  };
}

function articleContext(
  contentItemId: string,
  publishedVersionId: string,
  occurredAt = "2026-08-21T10:15:00.000Z",
) {
  return signAnalyticsContext({
    signingKey: SIGNING_KEY,
    now: new Date(occurredAt),
    surface: ANALYTICS_SURFACE.ARTICLE,
    contentItemId,
    publishedVersionId,
  });
}

function homepageSlotContext(input: {
  contentItemId: string;
  publishedVersionId: string;
  homepageVersionId: string;
  placement: string;
  position: number;
  occurredAt?: string;
}) {
  return signAnalyticsContext({
    signingKey: SIGNING_KEY,
    now: new Date(input.occurredAt ?? "2026-08-21T10:00:00.000Z"),
    surface: ANALYTICS_SURFACE.HOMEPAGE,
    contentItemId: input.contentItemId,
    publishedVersionId: input.publishedVersionId,
    homepageVersionId: input.homepageVersionId,
    placement: input.placement as typeof ANALYTICS_PLACEMENT.LEAD,
    position: input.position,
  });
}

describe("analytics aggregation PostgreSQL", () => {
  let fixture: IntegrationFixture;

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    fixture = await createFixture();
  });

  afterEach(async () => {
    const itemIds = fixture.createdItemIds.slice();
    await cleanupFixture(fixture);
    const leftover = await countLeftoverFixtures(itemIds);
    assert.equal(leftover.items, 0);
  });

  after(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const leftoverTx = await countOpenTestTransactions();
    assert.equal(leftoverTx, 0, "integration tests leaked open transactions");
    await closeIntegrationConnections();
  });

  async function publishApproved(title: string) {
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
    const published = await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    return { ...created, published };
  }

  async function ingestArticleView(input: {
    contentItemId: string;
    publishedVersionId: string;
    occurredAt: string;
    eventId?: string;
    sessionId?: string;
    context?: ReturnType<typeof ingestContext>;
  }) {
    return ingestPublicAnalyticsEvent(
      {
        eventId: input.eventId ?? randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: input.occurredAt,
        ...(input.sessionId ? { anonymousSessionId: input.sessionId } : {}),
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: articleContext(
          input.contentItemId,
          input.publishedVersionId,
          input.occurredAt,
        ),
        properties: { contentItemId: input.contentItemId },
      },
      input.context ?? ingestContext(),
    );
  }

  it("aggregates HUMAN views, excludes other traffic, and is idempotent", async () => {
    const article = await publishApproved("Aggregate article");
    const occurredAt = "2026-08-21T10:15:00.000Z";
    const eventId = randomUUID();
    const first = await ingestArticleView({
      contentItemId: article.contentItemId,
      publishedVersionId: article.versionId,
      occurredAt,
      eventId,
    });
    assert.equal(first.ok, true);
    const duplicate = await ingestArticleView({
      contentItemId: article.contentItemId,
      publishedVersionId: article.versionId,
      occurredAt,
      eventId,
    });
    assert.equal(duplicate.ok, true);
    await ingestArticleView({
      contentItemId: article.contentItemId,
      publishedVersionId: article.versionId,
      occurredAt: "2026-08-21T10:16:00.000Z",
      context: ingestContext({
        trafficSignals: { userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      }),
    });
    await ingestArticleView({
      contentItemId: article.contentItemId,
      publishedVersionId: article.versionId,
      occurredAt: "2026-08-21T10:17:00.000Z",
      context: ingestContext({
        trafficSignals: { trustedInternalEvidence: true },
      }),
    });
    await ingestArticleView({
      contentItemId: article.contentItemId,
      publishedVersionId: article.versionId,
      occurredAt: "2026-08-21T10:18:00.000Z",
      context: ingestContext({
        trafficSignals: { trustedTestEvidence: true },
      }),
    });

    const firstRun = await aggregateAnalyticsWindow(AGGREGATE_AUG_21);
    assert.equal(firstRun.ok, true);
    if (!firstRun.ok) return;
    assert.equal(firstRun.quality.eligibleCount, 1);
    assert.equal(firstRun.quality.excludedBotCount, 1);
    assert.equal(firstRun.quality.excludedInternalCount, 1);
    assert.equal(firstRun.quality.excludedTestCount, 1);
    assert.equal(firstRun.quality.duplicateEventIdsSkipped, 0);

    const secondRun = await aggregateAnalyticsWindow(AGGREGATE_AUG_21);
    assert.equal(secondRun.ok, true);
    if (!secondRun.ok) return;
    assert.equal(secondRun.quality.eligibleCount, 1);

    const rows = await getDb().select().from(analyticsContentDaily);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.articleViews, 1);
    assert.equal(rows[0]?.contentItemId, article.contentItemId);
    assert.equal(rows[0]?.publishedVersionId, article.versionId);
    assert.equal(rows[0]?.bucketStart.toISOString(), "2026-08-20T21:00:00.000Z");
  });

  it("includes a late event after window recompute and removes stale aggregate rows", async () => {
    const article = await publishApproved("Late event article");
    await ingestArticleView({
      contentItemId: article.contentItemId,
      publishedVersionId: article.versionId,
      occurredAt: "2026-08-21T09:00:00.000Z",
    });
    await aggregateAnalyticsWindow(AGGREGATE_AUG_21);

    await getDb().insert(analyticsContentDaily).values({
      bucketStart: new Date("2026-08-21T00:00:00.000Z"),
      contentItemId: randomUUID(),
      publishedVersionId: randomUUID(),
      articleViews: 9,
    });

    await ingestArticleView({
      contentItemId: article.contentItemId,
      publishedVersionId: article.versionId,
      occurredAt: "2026-08-21T11:00:00.000Z",
    });
    await aggregateAnalyticsWindow(AGGREGATE_AUG_21);

    const rows = await getDb().select().from(analyticsContentDaily);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.articleViews, 2);
    assert.equal(rows[0]?.contentItemId, article.contentItemId);
  });

  it("keeps version A views on A after publishing B and slug changes", async () => {
    const first = await publishApproved("Version A title");
    await ingestArticleView({
      contentItemId: first.contentItemId,
      publishedVersionId: first.versionId,
      occurredAt: "2026-08-21T10:00:00.000Z",
    });
    await ingestArticleView({
      contentItemId: first.contentItemId,
      publishedVersionId: first.versionId,
      occurredAt: "2026-08-21T10:01:00.000Z",
    });

    const revision = await createDraftRevision(
      first.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    const submitted = await submitForReview(
      first.contentItemId,
      revision.versionId,
      {
        expectedUpdatedAt: revision.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(first.contentItemId, revision.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    const publishedB = await publishVersion(
      first.contentItemId,
      revision.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    await ingestArticleView({
      contentItemId: first.contentItemId,
      publishedVersionId: revision.versionId,
      occurredAt: "2026-08-21T12:00:00.000Z",
    });

    await updateContentSlug({
      contentItemId: first.contentItemId,
      nextSlug: "changed-slug-after-views",
      expectedUpdatedAt: publishedB.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });

    await aggregateAnalyticsWindow(AGGREGATE_AUG_21);

    const rows = await getDb()
      .select()
      .from(analyticsContentDaily)
      .where(eq(analyticsContentDaily.contentItemId, first.contentItemId));
    const versionA = rows.find((row) => row.publishedVersionId === first.versionId);
    const versionB = rows.find((row) => row.publishedVersionId === revision.versionId);
    assert.equal(versionA?.articleViews, 2);
    assert.equal(versionB?.articleViews, 1);
    assert.equal(
      rows.reduce((sum, row) => sum + row.articleViews, 0),
      3,
    );

    const content = await getAnalyticsContentPerformance({
      period: ISTANBUL_AUG_21,
      scope: fixture.superAdmin,
      sort: ANALYTICS_CONTENT_SORT.ARTICLE_VIEWS,
      limit: 10,
      minImpressions: 1,
    });
    assert.equal(content.items[0]?.contentItemId, first.contentItemId);
    assert.equal(content.items[0]?.articleViews, 3);
    assert.equal(content.items[0]?.display?.slug, "changed-slug-after-views");
  });

  it("reports homepage CTR without clamping and scoped editors cannot see other categories", async () => {
    const articleA = await publishApproved("Lead story");
    let builder = await getHomepageBuilder(
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    builder = await setHomepageSlot({
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: articleA.contentItemId,
      expectedUpdatedAt: builder.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    const publishedHome = await publishHomepage({
      expectedUpdatedAt: builder.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    const homepageVersionId = publishedHome.published?.versionId;
    assert.equal(typeof homepageVersionId, "string");
    const leadToken = homepageSlotContext({
      contentItemId: articleA.contentItemId,
      publishedVersionId: articleA.versionId,
      homepageVersionId: homepageVersionId as string,
      placement: ANALYTICS_PLACEMENT.LEAD,
      position: 1,
      occurredAt: "2026-08-21T10:00:00.000Z",
    });

    await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T10:00:00.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: leadToken,
        properties: {
          contentItemId: articleA.contentItemId,
          placement: ANALYTICS_PLACEMENT.LEAD,
          position: 1,
          homepageVersionId,
          pageViewContextId: randomUUID(),
        },
      },
      ingestContext(),
    );
    await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T10:00:01.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: leadToken,
        properties: {
          contentItemId: articleA.contentItemId,
          placement: ANALYTICS_PLACEMENT.LEAD,
          position: 1,
          homepageVersionId,
          pageViewContextId: randomUUID(),
        },
      },
      ingestContext(),
    );
    await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T10:00:02.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: leadToken,
        properties: {
          contentItemId: articleA.contentItemId,
          placement: ANALYTICS_PLACEMENT.LEAD,
          position: 1,
          homepageVersionId,
          pageViewContextId: randomUUID(),
        },
      },
      ingestContext(),
    );

    await aggregateAnalyticsWindow(AGGREGATE_AUG_21);

    const slots = await getAnalyticsHomepageSlots({
      period: ISTANBUL_AUG_21,
      scope: fixture.superAdmin,
    });
    const leadSlot = slots.items.find((row) => row.placement === ANALYTICS_PLACEMENT.LEAD);
    assert.equal(leadSlot?.impressions, 1);
    assert.equal(leadSlot?.clicks, 2);
    assert.equal(leadSlot?.ctr, 2);
    assert.equal(leadSlot?.homepageVersionId, homepageVersionId);

    const overview = await getAnalyticsOverview({
      period: ISTANBUL_AUG_21,
      scope: fixture.superAdmin,
    });
    assert.equal(overview.metrics.homepageCtr, 2);
    assert.equal(overview.metricAvailability.ARTICLE_VIEWS.status, "AVAILABLE");
    assert.equal(overview.metricAvailability.VIDEO_PLAYS.status, "UNAVAILABLE");
    assert.equal(overview.metricAvailability.SESSIONS.status, "UNAVAILABLE");
    assert.equal(
      overview.metricAvailability.SESSIONS.status === "UNAVAILABLE"
        ? overview.metricAvailability.SESSIONS.reason
        : null,
      ANALYTICS_METRIC_AVAILABILITY_REASON.CONSENT_INTEGRATION_PENDING,
    );
    assert.equal(overview.metricAvailability.UNIQUE_VISITORS.status, "UNAVAILABLE");
    assert.equal("sessions" in overview.metrics, false);

    const scopedB = await getAnalyticsOverview({
      period: ISTANBUL_AUG_21,
      scope: fixture.selectedOnB,
    });
    assert.equal(scopedB.metrics.articleViews, 0);
    assert.equal(scopedB.metricAvailability.ARTICLE_VIEWS.status, "AVAILABLE");
    assert.equal(scopedB.metrics.homepageClicks, 0);

    const sources = await getAnalyticsSources({
      period: ISTANBUL_AUG_21,
      scope: fixture.superAdmin,
    });
    assert.equal(sources.items.some((row) => row.sourceChannel === "SEARCH"), true);

    const categories = await getAnalyticsCategories({
      period: ISTANBUL_AUG_21,
      scope: fixture.selectedOnB,
    });
    assert.equal(categories.items.length, 0);
  });

  it("keeps historical metrics after retraction and attributes authors with full credit", async () => {
    const article = await publishApproved("To retract");
    await ingestArticleView({
      contentItemId: article.contentItemId,
      publishedVersionId: article.versionId,
      occurredAt: "2026-08-21T10:00:00.000Z",
    });
    await aggregateAnalyticsWindow(AGGREGATE_AUG_21);
    await recordContentLegalAction({
      contentItemId: article.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.EDITORIAL_STANDARDS,
      internalNote: "Do not leak this note",
      publicNote: "Retracted.",
      expectedUpdatedAt: article.published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });

    const overview = await getAnalyticsOverview({
      period: ISTANBUL_AUG_21,
      scope: fixture.superAdmin,
    });
    assert.equal(overview.metrics.articleViews, 1);
    const authors = await getAnalyticsAuthors({
      period: ISTANBUL_AUG_21,
      scope: fixture.superAdmin,
    });
    assert.equal(authors.attribution, "FULL_CREDIT");
    assert.equal(authors.items[0]?.authorId, fixture.ids.author);
    assert.equal(authors.items[0]?.articleViews, 1);
    assert.equal(JSON.stringify(authors).includes("passwordHash"), false);
    assert.equal(JSON.stringify(authors).includes("Do not leak"), false);

    const series = await getAnalyticsTimeSeries({
      period: ISTANBUL_AUG_21,
      metric: ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS,
      scope: fixture.superAdmin,
    });
    assert.equal(series.points.length >= 1, true);
    assert.equal(
      series.points.reduce((sum, point) => sum + Number(point.value ?? 0), 0),
      1,
    );
  });

  it("aggregates recency fallback separately from builder placements", async () => {
    const lead = await publishApproved("Builder lead");
    const fallbackStory = await publishApproved("Recency fallback story");
    let builder = await getHomepageBuilder(
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    builder = await setHomepageSlot({
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: lead.contentItemId,
      expectedUpdatedAt: builder.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    const publishedHome = await publishHomepage({
      expectedUpdatedAt: builder.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    const homepageVersionId = publishedHome.published?.versionId;
    assert.equal(typeof homepageVersionId, "string");

    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      analyticsContextSigningKey: SIGNING_KEY,
      analyticsContextNow: new Date("2026-08-21T10:00:00.000Z"),
    });
    const fallback = homepage.analyticsPlacements.find(
      (placement) =>
        placement.placement === ANALYTICS_PLACEMENT.RECENCY_FALLBACK &&
        placement.contentItemId === fallbackStory.contentItemId,
    );
    assert.equal(typeof fallback?.analyticsContext, "string");

    const leadAccepted = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T10:00:00.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: homepageSlotContext({
          contentItemId: lead.contentItemId,
          publishedVersionId: lead.versionId,
          homepageVersionId: homepageVersionId as string,
          placement: ANALYTICS_PLACEMENT.LEAD,
          position: 1,
        }),
        properties: {
          contentItemId: lead.contentItemId,
          placement: ANALYTICS_PLACEMENT.LEAD,
          position: 1,
          homepageVersionId,
          pageViewContextId: randomUUID(),
        },
      },
      ingestContext(),
    );
    assert.equal(leadAccepted.ok, true);

    const fallbackImpression = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T10:00:01.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: fallback?.analyticsContext,
        properties: {
          contentItemId: fallbackStory.contentItemId,
          placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
          position: fallback?.position,
          pageViewContextId: randomUUID(),
        },
      },
      ingestContext(),
    );
    assert.equal(fallbackImpression.ok, true);
    const fallbackClick = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T10:00:02.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: fallback?.analyticsContext,
        properties: {
          contentItemId: fallbackStory.contentItemId,
          placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
          position: fallback?.position,
          pageViewContextId: randomUUID(),
        },
      },
      ingestContext(),
    );
    assert.equal(fallbackClick.ok, true);

    await aggregateAnalyticsWindow(AGGREGATE_AUG_21);
    const slots = await getAnalyticsHomepageSlots({
      period: ISTANBUL_AUG_21,
      scope: fixture.superAdmin,
    });
    const builderRow = slots.items.find(
      (row) =>
        row.placement === ANALYTICS_PLACEMENT.LEAD &&
        row.contentItemId === lead.contentItemId,
    );
    const fallbackRow = slots.items.find(
      (row) =>
        row.placement === ANALYTICS_PLACEMENT.RECENCY_FALLBACK &&
        row.contentItemId === fallbackStory.contentItemId,
    );
    assert.equal(builderRow?.impressions, 1);
    assert.equal(builderRow?.clicks, 0);
    assert.equal(builderRow?.homepageVersionId, homepageVersionId);
    assert.equal(fallbackRow?.impressions, 1);
    assert.equal(fallbackRow?.clicks, 1);
    assert.equal(fallbackRow?.homepageVersionId, null);
    assert.equal(typeof builderRow?.display?.title, "string");
    assert.match(builderRow?.display?.title ?? "", /\S/);
    assert.equal(typeof fallbackRow?.display?.title, "string");
    assert.match(fallbackRow?.display?.title ?? "", /\S/);
  });
});
