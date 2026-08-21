import { and, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from "drizzle-orm";
import {
  ANALYTICS_AGGREGATION_JOB_NAME,
  ANALYTICS_CONTENT_SORT,
  ANALYTICS_FRESHNESS_POLICY,
  ANALYTICS_METRIC_AVAILABILITY,
  ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY,
  ANALYTICS_REPORTING_METRIC,
  ANALYTICS_TIME_BUCKET,
  compareAnalyticsCounts,
  enumerateUtcBuckets,
  previousAnalyticsPeriod,
  reportingHomepageCtr,
  resolveAnalyticsMetricAvailability,
  scopedCategoryIdsForQuery,
  selectEditorDisplayVersionId,
  type AnalyticsContentSort,
  type AnalyticsFreshnessState,
  type AnalyticsReportingMetric,
  type AnalyticsReportingPeriod,
  type EditorStaffScope,
  type AnalyticsTrafficSource,
} from "@magazine/domain";
import { getDb } from "../client";
import { authors } from "../schema/authors";
import {
  contentItems,
  contentVersionAuthors,
  contentVersionCategories,
  contentVersions,
} from "../schema/content";
import { categories } from "../schema/taxonomy";
import {
  analyticsAggregationCheckpoints,
  analyticsAuthorDaily,
  analyticsCategoryDaily,
  analyticsContentDaily,
  analyticsContentHourly,
  analyticsHomepageSlotDaily,
  analyticsSourceDaily,
} from "../schema/analytics-aggregates";

export type AnalyticsReportScope = EditorStaffScope;

function contentTable(period: AnalyticsReportingPeriod) {
  return period.granularity === ANALYTICS_TIME_BUCKET.HOUR
    ? analyticsContentHourly
    : analyticsContentDaily;
}

function inPeriod(
  column: Parameters<typeof gte>[0],
  period: AnalyticsReportingPeriod,
) {
  return and(gte(column, period.fromInclusive), lt(column, period.toExclusive));
}

async function accessibleContentIds(
  scope: AnalyticsReportScope,
): Promise<"unrestricted" | string[]> {
  const scoped = scopedCategoryIdsForQuery(scope);
  if (scoped === null) {
    return "unrestricted";
  }
  if (scoped.length === 0) {
    return [];
  }

  const db = getDb();
  const items = await db
    .select({
      id: contentItems.id,
      draftVersionId: contentItems.draftVersionId,
      scheduledVersionId: contentItems.scheduledVersionId,
      publishedVersionId: contentItems.publishedVersionId,
    })
    .from(contentItems)
    .where(isNull(contentItems.deletedAt));

  const displayIds = items
    .map((item) => ({
      id: item.id,
      displayVersionId: selectEditorDisplayVersionId(item),
    }))
    .filter((item): item is { id: string; displayVersionId: string } =>
      Boolean(item.displayVersionId),
    );

  if (displayIds.length === 0) {
    return [];
  }

  const versionIds = [...new Set(displayIds.map((item) => item.displayVersionId))];
  const primaryRows = await db
    .select({
      contentVersionId: contentVersionCategories.contentVersionId,
      categoryId: contentVersionCategories.categoryId,
    })
    .from(contentVersionCategories)
    .where(
      and(
        inArray(contentVersionCategories.contentVersionId, versionIds),
        eq(contentVersionCategories.isPrimary, true),
      ),
    );

  const allowed = new Set(scoped);
  const versionAllowed = new Set(
    primaryRows
      .filter((row) => allowed.has(row.categoryId))
      .map((row) => row.contentVersionId),
  );

  return displayIds
    .filter((item) => versionAllowed.has(item.displayVersionId))
    .map((item) => item.id);
}

function scopedContentCondition(
  contentItemId: Parameters<typeof inArray>[0],
  accessible: "unrestricted" | string[],
): SQL | undefined {
  if (accessible === "unrestricted") {
    return undefined;
  }
  if (accessible.length === 0) {
    return sql`false`;
  }
  return inArray(contentItemId, accessible);
}

export async function getAnalyticsFreshness(): Promise<AnalyticsFreshnessState> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(analyticsAggregationCheckpoints)
    .where(eq(analyticsAggregationCheckpoints.jobName, ANALYTICS_AGGREGATION_JOB_NAME))
    .limit(1);

  if (!row?.lastSuccessfulThrough || !row.lastCompletedAt) {
    return {
      status: "UNAVAILABLE",
      reason: row?.lastErrorSafeSummary
        ? "AGGREGATION_FAILED"
        : "AGGREGATION_PENDING",
      lastSuccessfulThrough: row?.lastSuccessfulThrough ?? null,
      lastErrorSafeSummary: row?.lastErrorSafeSummary ?? null,
    };
  }

  return {
    status: "AVAILABLE",
    lastSuccessfulThrough: row.lastSuccessfulThrough,
    lastCompletedAt: row.lastCompletedAt,
  };
}

async function sumContentMetrics(
  period: AnalyticsReportingPeriod,
  accessible: "unrestricted" | string[],
) {
  const table = contentTable(period);
  const db = getDb();
  const scopeSql = scopedContentCondition(table.contentItemId, accessible);
  const [row] = await db
    .select({
      articleViews: sql<number>`coalesce(sum(${table.articleViews}), 0)`.mapWith(Number),
      galleryOpens: sql<number>`coalesce(sum(${table.galleryOpens}), 0)`.mapWith(Number),
      galleryImageViews: sql<number>`coalesce(sum(${table.galleryImageViews}), 0)`.mapWith(Number),
      videoImpressions: sql<number>`coalesce(sum(${table.videoImpressions}), 0)`.mapWith(Number),
      homepageImpressions: sql<number>`coalesce(sum(${table.homepageImpressions}), 0)`.mapWith(Number),
      homepageClicks: sql<number>`coalesce(sum(${table.homepageClicks}), 0)`.mapWith(Number),
    })
    .from(table)
    .where(and(inPeriod(table.bucketStart, period), scopeSql));

  return {
    articleViews: row?.articleViews ?? 0,
    galleryOpens: row?.galleryOpens ?? 0,
    galleryImageViews: row?.galleryImageViews ?? 0,
    videoImpressions: row?.videoImpressions ?? 0,
    homepageImpressions: row?.homepageImpressions ?? 0,
    homepageClicks: row?.homepageClicks ?? 0,
  };
}

export async function getAnalyticsOverview(input: {
  period: AnalyticsReportingPeriod;
  scope: AnalyticsReportScope;
  comparePrevious?: boolean;
}) {
  const [freshness, accessible] = await Promise.all([
    getAnalyticsFreshness(),
    accessibleContentIds(input.scope),
  ]);
  const current = await sumContentMetrics(input.period, accessible);
  const previousPeriod = previousAnalyticsPeriod(input.period);
  const previous = input.comparePrevious
    ? await sumContentMetrics(
        { ...input.period, fromInclusive: previousPeriod.fromInclusive, toExclusive: previousPeriod.toExclusive },
        accessible,
      )
    : null;

  return {
    freshness,
    freshnessPolicy: ANALYTICS_FRESHNESS_POLICY,
    metricAvailability: {
      ...ANALYTICS_METRIC_AVAILABILITY,
      ARTICLE_VIEWS: resolveAnalyticsMetricAvailability({
        measurement: ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY.ARTICLE_VIEWS,
        freshness,
      }),
      HOMEPAGE_IMPRESSIONS: resolveAnalyticsMetricAvailability({
        measurement: ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY.HOMEPAGE_IMPRESSIONS,
        freshness,
      }),
      SESSIONS: ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY.SESSIONS,
      UNIQUE_VISITORS: ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY.UNIQUE_VISITORS,
      VIDEO_PLAYS: ANALYTICS_METRIC_MEASUREMENT_AVAILABILITY.VIDEO_PLAYS,
    },
    metrics: {
      articleViews: current.articleViews,
      homepageImpressions: current.homepageImpressions,
      homepageClicks: current.homepageClicks,
      homepageCtr: reportingHomepageCtr(
        current.homepageClicks,
        current.homepageImpressions,
      ),
      galleryOpens: current.galleryOpens,
      galleryImageViews: current.galleryImageViews,
      videoImpressions: current.videoImpressions,
    },
    comparison: previous
      ? {
          articleViews: compareAnalyticsCounts(current.articleViews, previous.articleViews),
          homepageClicks: compareAnalyticsCounts(
            current.homepageClicks,
            previous.homepageClicks,
          ),
        }
      : null,
  };
}

export async function getAnalyticsTimeSeries(input: {
  period: AnalyticsReportingPeriod;
  metric: AnalyticsReportingMetric;
  scope: AnalyticsReportScope;
}) {
  const [freshness, accessible] = await Promise.all([
    getAnalyticsFreshness(),
    accessibleContentIds(input.scope),
  ]);
  const table = contentTable(input.period);
  const db = getDb();
  const scopeSql = scopedContentCondition(table.contentItemId, accessible);

  const metricSql: Record<Exclude<AnalyticsReportingMetric, "HOMEPAGE_CTR">, SQL> = {
    [ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS]: sql<number>`coalesce(sum(${table.articleViews}), 0)`,
    [ANALYTICS_REPORTING_METRIC.HOMEPAGE_IMPRESSIONS]: sql<number>`coalesce(sum(${table.homepageImpressions}), 0)`,
    [ANALYTICS_REPORTING_METRIC.HOMEPAGE_CLICKS]: sql<number>`coalesce(sum(${table.homepageClicks}), 0)`,
    [ANALYTICS_REPORTING_METRIC.GALLERY_OPENS]: sql<number>`coalesce(sum(${table.galleryOpens}), 0)`,
    [ANALYTICS_REPORTING_METRIC.GALLERY_IMAGE_VIEWS]: sql<number>`coalesce(sum(${table.galleryImageViews}), 0)`,
    [ANALYTICS_REPORTING_METRIC.VIDEO_IMPRESSIONS]: sql<number>`coalesce(sum(${table.videoImpressions}), 0)`,
  };

  const buckets = enumerateUtcBuckets({
    fromInclusive: input.period.fromInclusive,
    toExclusive: input.period.toExclusive,
    granularity: input.period.granularity,
  });

  if (input.metric === ANALYTICS_REPORTING_METRIC.HOMEPAGE_CTR) {
    const rows = await db
      .select({
        bucketStart: table.bucketStart,
        clicks: sql<number>`coalesce(sum(${table.homepageClicks}), 0)`.mapWith(Number),
        impressions: sql<number>`coalesce(sum(${table.homepageImpressions}), 0)`.mapWith(
          Number,
        ),
      })
      .from(table)
      .where(and(inPeriod(table.bucketStart, input.period), scopeSql))
      .groupBy(table.bucketStart);
    const byBucket = new Map(
      rows.map((row) => [row.bucketStart.toISOString(), row]),
    );
    return {
      freshness,
      metric: input.metric,
      composableAcrossBuckets: false,
      points: buckets.map((bucketStart) => {
        const row = byBucket.get(bucketStart.toISOString());
        return {
          bucketStart,
          value: reportingHomepageCtr(row?.clicks ?? 0, row?.impressions ?? 0),
          clicks: row?.clicks ?? 0,
          impressions: row?.impressions ?? 0,
        };
      }),
    };
  }

  const rows = await db
    .select({
      bucketStart: table.bucketStart,
      value: metricSql[input.metric].mapWith(Number),
    })
    .from(table)
    .where(and(inPeriod(table.bucketStart, input.period), scopeSql))
    .groupBy(table.bucketStart);
  const byBucket = new Map(rows.map((row) => [row.bucketStart.toISOString(), row.value]));

  return {
    freshness,
    metric: input.metric,
    composableAcrossBuckets: true,
    points: buckets.map((bucketStart) => ({
      bucketStart,
      value: byBucket.get(bucketStart.toISOString()) ?? 0,
    })),
  };
}

export async function getAnalyticsContentPerformance(input: {
  period: AnalyticsReportingPeriod;
  scope: AnalyticsReportScope;
  sort: AnalyticsContentSort;
  limit: number;
  minImpressions: number;
  categoryId?: string | null;
  sourceChannel?: AnalyticsTrafficSource | null;
}) {
  const [freshness, accessible] = await Promise.all([
    getAnalyticsFreshness(),
    accessibleContentIds(input.scope),
  ]);
  const db = getDb();
  const table = analyticsContentDaily;
  const conditions: Array<SQL | undefined> = [
    inPeriod(table.bucketStart, input.period),
    scopedContentCondition(table.contentItemId, accessible),
  ];

  if (input.categoryId) {
    const categoryRows = await db
      .selectDistinct({ contentItemId: analyticsCategoryDaily.contentItemId })
      .from(analyticsCategoryDaily)
      .where(
        and(
          inPeriod(analyticsCategoryDaily.bucketStart, input.period),
          eq(analyticsCategoryDaily.primaryCategoryId, input.categoryId),
          scopedContentCondition(analyticsCategoryDaily.contentItemId, accessible),
        ),
      );
    const ids = categoryRows.map((row) => row.contentItemId);
    conditions.push(ids.length === 0 ? sql`false` : inArray(table.contentItemId, ids));
  }

  if (input.sourceChannel) {
    const sourceRows = await db
      .selectDistinct({ contentItemId: analyticsSourceDaily.contentItemId })
      .from(analyticsSourceDaily)
      .where(
        and(
          inPeriod(analyticsSourceDaily.bucketStart, input.period),
          eq(analyticsSourceDaily.trafficSource, input.sourceChannel),
          scopedContentCondition(analyticsSourceDaily.contentItemId, accessible),
        ),
      );
    const ids = sourceRows
      .map((row) => row.contentItemId)
      .filter((id): id is string => Boolean(id));
    conditions.push(ids.length === 0 ? sql`false` : inArray(table.contentItemId, ids));
  }

  const grouped = await db
    .select({
      contentItemId: table.contentItemId,
      articleViews: sql<number>`coalesce(sum(${table.articleViews}), 0)`.mapWith(Number),
      galleryOpens: sql<number>`coalesce(sum(${table.galleryOpens}), 0)`.mapWith(Number),
      galleryImageViews: sql<number>`coalesce(sum(${table.galleryImageViews}), 0)`.mapWith(
        Number,
      ),
      videoImpressions: sql<number>`coalesce(sum(${table.videoImpressions}), 0)`.mapWith(
        Number,
      ),
      homepageImpressions: sql<number>`coalesce(sum(${table.homepageImpressions}), 0)`.mapWith(
        Number,
      ),
      homepageClicks: sql<number>`coalesce(sum(${table.homepageClicks}), 0)`.mapWith(Number),
    })
    .from(table)
    .where(and(...conditions))
    .groupBy(table.contentItemId);

  const ranked = grouped
    .map((row) => ({
      ...row,
      homepageCtr: reportingHomepageCtr(row.homepageClicks, row.homepageImpressions),
    }))
    .filter((row) => {
      if (input.sort !== ANALYTICS_CONTENT_SORT.HOMEPAGE_CTR) {
        return true;
      }
      return row.homepageImpressions >= input.minImpressions;
    })
    .sort((left, right) => {
      if (input.sort === ANALYTICS_CONTENT_SORT.HOMEPAGE_CLICKS) {
        return right.homepageClicks - left.homepageClicks;
      }
      if (input.sort === ANALYTICS_CONTENT_SORT.HOMEPAGE_CTR) {
        return (right.homepageCtr ?? -1) - (left.homepageCtr ?? -1);
      }
      return right.articleViews - left.articleViews;
    })
    .slice(0, input.limit);

  const display = await loadContentDisplay(ranked.map((row) => row.contentItemId));

  return {
    freshness,
    items: ranked.map((row) => ({
      contentItemId: row.contentItemId,
      articleViews: row.articleViews,
      galleryOpens: row.galleryOpens,
      galleryImageViews: row.galleryImageViews,
      videoImpressions: row.videoImpressions,
      homepageImpressions: row.homepageImpressions,
      homepageClicks: row.homepageClicks,
      homepageCtr: row.homepageCtr,
      display: display.get(row.contentItemId) ?? null,
    })),
  };
}

async function loadContentDisplay(contentItemIds: string[]) {
  const map = new Map<
    string,
    {
      title: string;
      slug: string;
      publicationStatus: string;
      primaryCategoryId: string | null;
      primaryCategoryName: string | null;
      authors: { id: string; displayName: string }[];
    }
  >();
  if (contentItemIds.length === 0) {
    return map;
  }

  const db = getDb();
  const items = await db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      publicationStatus: contentItems.publicationStatus,
      draftVersionId: contentItems.draftVersionId,
      scheduledVersionId: contentItems.scheduledVersionId,
      publishedVersionId: contentItems.publishedVersionId,
    })
    .from(contentItems)
    .where(inArray(contentItems.id, contentItemIds));

  const versionIds = items
    .map((item) => selectEditorDisplayVersionId(item))
    .filter((id): id is string => Boolean(id));

  const versions =
    versionIds.length === 0
      ? []
      : await db
          .select({
            id: contentVersions.id,
            title: contentVersions.title,
          })
          .from(contentVersions)
          .where(inArray(contentVersions.id, versionIds));
  const titleByVersion = new Map(versions.map((row) => [row.id, row.title]));

  const categoryRows =
    versionIds.length === 0
      ? []
      : await db
          .select({
            contentVersionId: contentVersionCategories.contentVersionId,
            categoryId: categories.id,
            name: categories.name,
          })
          .from(contentVersionCategories)
          .innerJoin(categories, eq(categories.id, contentVersionCategories.categoryId))
          .where(
            and(
              inArray(contentVersionCategories.contentVersionId, versionIds),
              eq(contentVersionCategories.isPrimary, true),
            ),
          );
  const categoryByVersion = new Map(
    categoryRows.map((row) => [
      row.contentVersionId,
      { id: row.categoryId, name: row.name },
    ]),
  );

  const authorRows =
    versionIds.length === 0
      ? []
      : await db
          .select({
            contentVersionId: contentVersionAuthors.contentVersionId,
            id: authors.id,
            displayName: authors.displayName,
            sortOrder: contentVersionAuthors.sortOrder,
          })
          .from(contentVersionAuthors)
          .innerJoin(authors, eq(authors.id, contentVersionAuthors.authorId))
          .where(inArray(contentVersionAuthors.contentVersionId, versionIds))
          .orderBy(contentVersionAuthors.sortOrder);
  const authorsByVersion = new Map<string, { id: string; displayName: string }[]>();
  for (const row of authorRows) {
    const list = authorsByVersion.get(row.contentVersionId) ?? [];
    list.push({ id: row.id, displayName: row.displayName });
    authorsByVersion.set(row.contentVersionId, list);
  }

  for (const item of items) {
    const displayVersionId = selectEditorDisplayVersionId(item);
    const category = displayVersionId
      ? categoryByVersion.get(displayVersionId)
      : undefined;
    map.set(item.id, {
      title: displayVersionId
        ? (titleByVersion.get(displayVersionId) ?? item.slug)
        : item.slug,
      slug: item.slug,
      publicationStatus: item.publicationStatus,
      primaryCategoryId: category?.id ?? null,
      primaryCategoryName: category?.name ?? null,
      authors: displayVersionId ? (authorsByVersion.get(displayVersionId) ?? []) : [],
    });
  }

  return map;
}

export async function getAnalyticsSources(input: {
  period: AnalyticsReportingPeriod;
  scope: AnalyticsReportScope;
}) {
  const [freshness, accessible] = await Promise.all([
    getAnalyticsFreshness(),
    accessibleContentIds(input.scope),
  ]);
  const db = getDb();
  const rows = await db
    .select({
      trafficSource: analyticsSourceDaily.trafficSource,
      eventCount: sql<number>`coalesce(sum(${analyticsSourceDaily.eventCount}), 0)`.mapWith(
        Number,
      ),
    })
    .from(analyticsSourceDaily)
    .where(
      and(
        inPeriod(analyticsSourceDaily.bucketStart, input.period),
        scopedContentCondition(analyticsSourceDaily.contentItemId, accessible),
      ),
    )
    .groupBy(analyticsSourceDaily.trafficSource)
    .orderBy(desc(sql`sum(${analyticsSourceDaily.eventCount})`));

  const total = rows.reduce((sum, row) => sum + row.eventCount, 0);
  return {
    freshness,
    audience: "DEFAULT_HUMAN",
    total,
    items: rows.map((row) => ({
      sourceChannel: row.trafficSource,
      eventCount: row.eventCount,
    })),
  };
}

export async function getAnalyticsCategories(input: {
  period: AnalyticsReportingPeriod;
  scope: AnalyticsReportScope;
}) {
  const [freshness, accessible] = await Promise.all([
    getAnalyticsFreshness(),
    accessibleContentIds(input.scope),
  ]);
  const db = getDb();
  const rows = await db
    .select({
      primaryCategoryId: analyticsCategoryDaily.primaryCategoryId,
      articleViews: sql<number>`coalesce(sum(${analyticsCategoryDaily.articleViews}), 0)`.mapWith(
        Number,
      ),
      contentCount: sql<number>`count(distinct ${analyticsCategoryDaily.contentItemId})`.mapWith(
        Number,
      ),
    })
    .from(analyticsCategoryDaily)
    .where(
      and(
        inPeriod(analyticsCategoryDaily.bucketStart, input.period),
        scopedContentCondition(analyticsCategoryDaily.contentItemId, accessible),
      ),
    )
    .groupBy(analyticsCategoryDaily.primaryCategoryId)
    .orderBy(desc(sql`sum(${analyticsCategoryDaily.articleViews})`));

  const ids = rows.map((row) => row.primaryCategoryId);
  const names =
    ids.length === 0
      ? []
      : await db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(inArray(categories.id, ids));
  const nameById = new Map(names.map((row) => [row.id, row.name]));

  return {
    freshness,
    attribution: "EVENT_TIME_PRIMARY_CATEGORY",
    items: rows.map((row) => ({
      categoryId: row.primaryCategoryId,
      name: nameById.get(row.primaryCategoryId) ?? null,
      articleViews: row.articleViews,
      contentCount: row.contentCount,
    })),
  };
}

export async function getAnalyticsAuthors(input: {
  period: AnalyticsReportingPeriod;
  scope: AnalyticsReportScope;
}) {
  const [freshness, accessible] = await Promise.all([
    getAnalyticsFreshness(),
    accessibleContentIds(input.scope),
  ]);
  const db = getDb();
  const rows = await db
    .select({
      authorId: analyticsAuthorDaily.authorId,
      articleViews: sql<number>`coalesce(sum(${analyticsAuthorDaily.articleViews}), 0)`.mapWith(
        Number,
      ),
      contentCount: sql<number>`count(distinct ${analyticsAuthorDaily.contentItemId})`.mapWith(
        Number,
      ),
    })
    .from(analyticsAuthorDaily)
    .where(
      and(
        inPeriod(analyticsAuthorDaily.bucketStart, input.period),
        scopedContentCondition(analyticsAuthorDaily.contentItemId, accessible),
      ),
    )
    .groupBy(analyticsAuthorDaily.authorId)
    .orderBy(desc(sql`sum(${analyticsAuthorDaily.articleViews})`));

  const ids = rows.map((row) => row.authorId);
  const names =
    ids.length === 0
      ? []
      : await db
          .select({ id: authors.id, displayName: authors.displayName })
          .from(authors)
          .where(inArray(authors.id, ids));
  const nameById = new Map(names.map((row) => [row.id, row.displayName]));

  return {
    freshness,
    attribution: "FULL_CREDIT",
    items: rows.map((row) => ({
      authorId: row.authorId,
      displayName: nameById.get(row.authorId) ?? null,
      articleViews: row.articleViews,
      contentCount: row.contentCount,
    })),
  };
}

export async function getAnalyticsHomepageSlots(input: {
  period: AnalyticsReportingPeriod;
  scope: AnalyticsReportScope;
}) {
  const [freshness, accessible] = await Promise.all([
    getAnalyticsFreshness(),
    accessibleContentIds(input.scope),
  ]);
  const db = getDb();
  const rows = await db
    .select({
      homepageVersionId: analyticsHomepageSlotDaily.homepageVersionId,
      placement: analyticsHomepageSlotDaily.placement,
      position: analyticsHomepageSlotDaily.position,
      contentItemId: analyticsHomepageSlotDaily.contentItemId,
      impressions: sql<number>`coalesce(sum(${analyticsHomepageSlotDaily.impressions}), 0)`.mapWith(
        Number,
      ),
      clicks: sql<number>`coalesce(sum(${analyticsHomepageSlotDaily.clicks}), 0)`.mapWith(
        Number,
      ),
    })
    .from(analyticsHomepageSlotDaily)
    .where(
      and(
        inPeriod(analyticsHomepageSlotDaily.bucketStart, input.period),
        scopedContentCondition(analyticsHomepageSlotDaily.contentItemId, accessible),
      ),
    )
    .groupBy(
      analyticsHomepageSlotDaily.homepageVersionId,
      analyticsHomepageSlotDaily.placement,
      analyticsHomepageSlotDaily.position,
      analyticsHomepageSlotDaily.contentItemId,
    );

  const display = await loadContentDisplay(rows.map((row) => row.contentItemId));

  return {
    freshness,
    items: rows.map((row) => ({
      homepageVersionId: row.homepageVersionId,
      placement: row.placement,
      position: row.position,
      contentItemId: row.contentItemId,
      impressions: row.impressions,
      clicks: row.clicks,
      ctr: reportingHomepageCtr(row.clicks, row.impressions),
      display: display.get(row.contentItemId) ?? null,
    })),
  };
}
