import { asc, sql } from "drizzle-orm";
import {
  ANALYTICS_CONTENT_SORT,
  ANALYTICS_REPORTING_TIMEZONE,
  ANALYTICS_REPORTING_METRIC,
  ANALYTICS_TIME_BUCKET,
  CAPABILITY,
  CONTENT_LEGAL_ACTION_TYPE,
  PUBLICATION_STATUS,
  REVIEW_EVENT_TYPE,
  STAFF_MFA_FACTOR_STATUS,
  STAFF_ROLE,
  STAFF_STATUS,
  WORKFLOW_STATUS,
  hasCapability,
  parseAnalyticsReportingPeriod,
  reportingCalendarDate,
  type AnalyticsReportingPeriod,
  type EditorStaffScope,
} from "@magazine/domain";
import {
  getAnalyticsAuthors,
  getAnalyticsCategories,
  getAnalyticsContentPerformance,
  getAnalyticsFreshness,
  getAnalyticsHomepageSlots,
  getAnalyticsOverview,
  getAnalyticsSources,
  getAnalyticsTimeSeries,
} from "../analytics/report";
import { getDb } from "../client";
import { countPublicCacheOutboxEventsByStatus } from "../public-cache-outbox";
import { summarizeSeoInspections } from "../seo/inspection";
import {
  contentItems,
  contentLegalActions,
  contentVersionCategories,
  contentVersions,
} from "../schema/content";
import {
  homepageSlots,
  homepageVersions,
  homepages,
} from "../schema/homepage-builder";
import { contentReviewEvents } from "../schema/review-events";
import {
  staffMfaFactors,
  staffUserRoles,
  staffUsers,
} from "../schema/staff";
import { categories } from "../schema/taxonomy";
import { listLegalDashboard } from "./legal-workspace";
import { listReviewQueue } from "./review-queue";

const DASHBOARD_LIMITS = {
  ATTENTION: 8,
  UPCOMING: 8,
  REVIEW: 5,
  LEGAL: 5,
  PERFORMANCE: 5,
} as const;

export type DashboardSection<T> =
  | { status: "AVAILABLE"; data: T }
  | { status: "UNAVAILABLE"; reason: "SOURCE_UNAVAILABLE" };

export type SuperAdminDashboardInput = {
  scope: EditorStaffScope;
  now?: Date;
};

export type SuperAdminEditorialSummary = {
  draft: number;
  inReview: number;
  approved: number;
  changesRequested: number;
  scheduled: number;
  published: number;
};

export type SuperAdminAttentionItem = {
  contentItemId: string;
  versionId: string;
  title: string;
  signal:
    | "CHANGES_REQUESTED"
    | "LEGAL_HOLD"
    | "TAKEDOWN"
    | "RETRACTION"
    | "READINESS_BLOCKED";
  eventAt: string;
  targetHref: string;
};

export type SuperAdminUpcomingPublishingItem = {
  contentItemId: string;
  versionId: string;
  title: string;
  scheduledAt: string;
  primaryCategory: { id: string; name: string; slug: string } | null;
  targetHref: string;
};

export type SuperAdminReviewSummary = {
  count: number;
  changesRequested: number;
  items: {
    contentItemId: string;
    versionId: string;
    title: string;
    latestSubmittedAt: string;
    reviewRound: number;
    primaryCategory: { id: string; name: string; slug: string } | null;
    targetHref: string;
  }[];
  targetHref: "/review";
};

export type SuperAdminAnalyticsSummary = {
  period: {
    fromInclusive: string;
    toExclusive: string;
    granularity: typeof ANALYTICS_TIME_BUCKET.DAY;
    timezone: typeof ANALYTICS_REPORTING_TIMEZONE;
  };
  freshness: unknown;
  metricAvailability: unknown;
  metrics: {
    articleViews: number;
    homepageImpressions: number;
    homepageClicks: number;
    homepageCtr: number | null;
  };
  comparison: unknown;
  timeSeries: {
    bucketStart: string;
    articleViews: number;
    homepageImpressions: number;
  }[];
  topContent: {
    contentItemId: string;
    title: string;
    primaryCategoryName: string | null;
    authorNames: string[];
    articleViews: number;
    homepageClicks: number;
    homepageCtr: number | null;
    targetHref: string;
  }[];
  trafficSources: {
    sourceChannel: string;
    eventCount: number;
    share: number | null;
  }[];
  categories: {
    categoryId: string;
    name: string | null;
    articleViews: number;
    contentCount: number;
    share: number | null;
  }[];
  authors: {
    authorId: string;
    displayName: string | null;
    articleViews: number;
    contentCount: number;
  }[];
  homepageSlots: {
    placement: string;
    position: number;
    title: string | null;
    impressions: number;
    clicks: number;
    ctr: number | null;
  }[];
};

export type SuperAdminLegalSummary = {
  activeHolds: number;
  activeTakedowns: number;
  activeRetractions: number;
  corrections: number;
  recentActions: {
    actionId: string;
    contentItemId: string;
    articleTitle: string;
    actionType: string;
    effectiveAt: string;
    createdAt: string;
    targetHref: string;
  }[];
  activeHoldItems: {
    contentItemId: string;
    title: string;
    legalHoldAt: string;
    publicationStatus: string;
    targetHref: string;
  }[];
};

export type SuperAdminStaffSecuritySummary = {
  total: number;
  active: number;
  disabled: number;
  superAdmin: number;
  mfaConfigured: number;
  mfaNotConfigured: number;
};

export type SuperAdminHomepageStatus = {
  liveVersionId: string | null;
  lastPublishedAt: string | null;
  unpublishedDraftExists: boolean;
  publishedSlotCount: number;
  draftSlotCount: number;
};

export type SuperAdminSeoSummary = {
  accessibleCount: number;
  errorCount: number;
  warningCount: number;
  missingMetaDescriptionCount: number;
  missingHeroCount: number;
  notIndexableCount: number;
  healthyPublishedCount: number;
  measurements: unknown;
};

export type SuperAdminSystemSignals = {
  publicCacheOutbox: {
    pending: number;
    processing: number;
    completed: number;
    dead: number;
    failed: number;
  };
  analyticsFreshness: unknown;
};

export type SuperAdminDashboardDto = {
  generatedAt: string;
  editorial: DashboardSection<SuperAdminEditorialSummary>;
  attention: DashboardSection<{
    limit: typeof DASHBOARD_LIMITS.ATTENTION;
    total: number;
    items: SuperAdminAttentionItem[];
  }>;
  upcomingPublishing: DashboardSection<{
    limit: typeof DASHBOARD_LIMITS.UPCOMING;
    items: SuperAdminUpcomingPublishingItem[];
  }>;
  review: DashboardSection<SuperAdminReviewSummary>;
  analytics: DashboardSection<SuperAdminAnalyticsSummary>;
  legal: DashboardSection<SuperAdminLegalSummary>;
  staffSecurity: DashboardSection<SuperAdminStaffSecuritySummary>;
  homepage: DashboardSection<SuperAdminHomepageStatus>;
  seo: DashboardSection<SuperAdminSeoSummary>;
  systemSignals: DashboardSection<SuperAdminSystemSignals>;
};

const FORBIDDEN_DTO_KEYS = new Set([
  "body",
  "storageKey",
  "rightsNote",
  "internalNote",
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "mfaSecret",
  "secretCiphertext",
  "recoveryCode",
  "recoveryCodes",
  "codeHash",
  "auditPayload",
  "eventId",
  "context",
  "anonymousId",
  "anonId",
  "constraint",
  "databaseUrl",
  "env",
]);

export function buildUnavailableSection<T>(): DashboardSection<T> {
  return { status: "UNAVAILABLE", reason: "SOURCE_UNAVAILABLE" };
}

export function assertSafeSuperAdminDashboardDto(value: unknown): void {
  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (FORBIDDEN_DTO_KEYS.has(key)) {
        throw new Error(`Super Admin dashboard DTO contains forbidden key: ${path}.${key}`);
      }
      visit(child, path ? `${path}.${key}` : key);
    }
  };
  visit(value, "dashboard");
}

function available<T>(data: T): DashboardSection<T> {
  return { status: "AVAILABLE", data };
}

async function section<T>(loader: () => Promise<T>): Promise<DashboardSection<T>> {
  try {
    return available(await loader());
  } catch {
    return buildUnavailableSection<T>();
  }
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function contentHref(contentItemId: string): string {
  return `/content/${encodeURIComponent(contentItemId)}`;
}

function changesRequestedOnDraftSql() {
  return sql`exists (
    select 1
    from ${contentReviewEvents} change_events
    where change_events.content_item_id = ${contentItems.id}
      and change_events.content_version_id = ${contentItems.draftVersionId}
      and change_events.event_type = ${REVIEW_EVENT_TYPE.CHANGES_REQUESTED}
  )`;
}

function reviewHref(contentItemId: string, versionId: string): string {
  return `/content/${encodeURIComponent(contentItemId)}?versionId=${encodeURIComponent(versionId)}&from=review&returnTo=%2Freview`;
}

function shiftDateOnly(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const shifted = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, "0"),
    String(shifted.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function defaultDashboardAnalyticsPeriod(now: Date): AnalyticsReportingPeriod {
  const to = reportingCalendarDate(now, ANALYTICS_REPORTING_TIMEZONE);
  const from = shiftDateOnly(to, -6);
  const decision = parseAnalyticsReportingPeriod({
    from,
    to,
    granularity: ANALYTICS_TIME_BUCKET.DAY,
  });
  if (!decision.ok) {
    throw new Error("Default dashboard analytics period is invalid.");
  }
  return decision.value;
}

function ensureSuperAdminDashboardAuthorized(scope: EditorStaffScope): void {
  if (!hasCapability(scope.roles, CAPABILITY.STAFF_MANAGE)) {
    throw new Error("FORBIDDEN");
  }
}

export async function getSuperAdminDashboard(
  input: SuperAdminDashboardInput,
): Promise<SuperAdminDashboardDto> {
  ensureSuperAdminDashboardAuthorized(input.scope);
  const now = input.now ?? new Date();
  const period = defaultDashboardAnalyticsPeriod(now);

  const [
    editorial,
    attention,
    upcomingPublishing,
    review,
    analytics,
    legal,
    staffSecurity,
    homepage,
    seoSection,
    systemSignals,
  ] = await Promise.all([
    section(() => loadEditorialSummary()),
    section(() => loadAttentionItems()),
    section(() => loadUpcomingPublishing(now)),
    section(() => loadReviewSummary()),
    section(() => loadAnalyticsSummary(input.scope, period)),
    section(() => loadLegalSummary()),
    section(() => loadStaffSecuritySummary()),
    section(() => loadHomepageStatus()),
    section(() => loadSeoSummary(input.scope)),
    section(() => loadSystemSignals()),
  ]);

  const dto: SuperAdminDashboardDto = {
    generatedAt: now.toISOString(),
    editorial,
    attention,
    upcomingPublishing,
    review,
    analytics,
    legal,
    staffSecurity,
    homepage,
    seo: seoSection,
    systemSignals,
  };
  assertSafeSuperAdminDashboardDto(dto);
  return dto;
}

async function loadEditorialSummary(): Promise<SuperAdminEditorialSummary> {
  const db = getDb();
  type EditorialSummaryRow = {
    draft: number;
    inReview: number;
    approved: number;
    changesRequested: number;
    scheduled: number;
    published: number;
  };
  const result = await db.execute(sql<EditorialSummaryRow>`
    select
      count(*) filter (where display_version.workflow_status = ${WORKFLOW_STATUS.DRAFT})::int as "draft",
      count(*) filter (where display_version.workflow_status = ${WORKFLOW_STATUS.IN_REVIEW})::int as "inReview",
      count(*) filter (where display_version.workflow_status = ${WORKFLOW_STATUS.APPROVED})::int as "approved",
      count(*) filter (where ${changesRequestedOnDraftSql()})::int as "changesRequested",
      count(*) filter (where ${contentItems.scheduledVersionId} is not null)::int as "scheduled",
      count(*) filter (where ${contentItems.publicationStatus} = ${PUBLICATION_STATUS.PUBLISHED})::int as "published"
    from ${contentItems}
    inner join ${contentVersions} display_version
      on display_version.id = coalesce(
        ${contentItems.draftVersionId},
        ${contentItems.scheduledVersionId},
        ${contentItems.publishedVersionId}
      )
    where ${contentItems.deletedAt} is null
  `);
  const row = result.rows[0] as EditorialSummaryRow | undefined;

  return {
    draft: Number(row?.draft ?? 0),
    inReview: Number(row?.inReview ?? 0),
    approved: Number(row?.approved ?? 0),
    changesRequested: Number(row?.changesRequested ?? 0),
    scheduled: Number(row?.scheduled ?? 0),
    published: Number(row?.published ?? 0),
  };
}

async function loadAttentionItems(): Promise<{
  limit: typeof DASHBOARD_LIMITS.ATTENTION;
  total: number;
  items: SuperAdminAttentionItem[];
}> {
  const db = getDb();
  type AttentionRow = {
    contentItemId: string;
    versionId: string;
    title: string;
    signal: SuperAdminAttentionItem["signal"];
    eventAt: Date;
    total: number;
  };
  const result = await db.execute(sql<AttentionRow>`
    select
      ${contentItems.id} as "contentItemId",
      display_version.id as "versionId",
      display_version.title as "title",
      case
        when ${contentItems.legalHoldAt} is not null then 'LEGAL_HOLD'
        when ${contentItems.takedownAt} is not null then 'TAKEDOWN'
        when ${contentItems.retractedAt} is not null then 'RETRACTION'
        when ${changesRequestedOnDraftSql()} then 'CHANGES_REQUESTED'
        else 'READINESS_BLOCKED'
      end as "signal",
      coalesce(
        ${contentItems.legalHoldAt},
        ${contentItems.takedownAt},
        ${contentItems.retractedAt},
        ${contentItems.updatedAt}
      ) as "eventAt",
      count(*) over()::int as "total"
    from ${contentItems}
    inner join ${contentVersions} display_version
      on display_version.id = coalesce(
        ${contentItems.draftVersionId},
        ${contentItems.scheduledVersionId},
        ${contentItems.publishedVersionId}
      )
    left join ${contentVersionCategories} display_primary
      on display_primary.content_version_id = display_version.id
      and display_primary.is_primary = true
    where ${contentItems.deletedAt} is null
      and (
        ${contentItems.legalHoldAt} is not null
        or ${contentItems.takedownAt} is not null
        or ${contentItems.retractedAt} is not null
        or (
          display_version.workflow_status = ${WORKFLOW_STATUS.APPROVED}
          and display_primary.category_id is null
        )
        or ${changesRequestedOnDraftSql()}
      )
    order by "eventAt" desc, ${contentItems.id} desc
    limit ${DASHBOARD_LIMITS.ATTENTION}
  `);
  const rows = result.rows as AttentionRow[];

  return {
    limit: DASHBOARD_LIMITS.ATTENTION,
    total: rows.length > 0 ? Number(rows[0]?.total ?? rows.length) : 0,
    items: rows.map((row) => ({
      contentItemId: row.contentItemId,
      versionId: row.versionId,
      title: row.title,
      signal: row.signal,
      eventAt: iso(row.eventAt)!,
      targetHref: contentHref(row.contentItemId),
    })),
  };
}

async function loadUpcomingPublishing(
  now: Date,
): Promise<{
  limit: typeof DASHBOARD_LIMITS.UPCOMING;
  items: SuperAdminUpcomingPublishingItem[];
}> {
  const db = getDb();
  const rows = await db
    .select({
      contentItemId: contentItems.id,
      versionId: contentVersions.id,
      title: contentVersions.title,
      scheduledAt: contentItems.scheduledAt,
      primaryCategoryId: categories.id,
      primaryCategoryName: categories.name,
      primaryCategorySlug: categories.slug,
    })
    .from(contentItems)
    .innerJoin(contentVersions, sql`${contentVersions.id} = ${contentItems.scheduledVersionId}`)
    .leftJoin(
      contentVersionCategories,
      sql`${contentVersionCategories.contentVersionId} = ${contentVersions.id}
        and ${contentVersionCategories.isPrimary} = true`,
    )
    .leftJoin(categories, sql`${categories.id} = ${contentVersionCategories.categoryId}`)
    .where(sql`${contentItems.deletedAt} is null
      and ${contentItems.scheduledVersionId} is not null
      and ${contentItems.scheduledAt} >= ${now}`)
    .orderBy(asc(contentItems.scheduledAt), asc(contentItems.id))
    .limit(DASHBOARD_LIMITS.UPCOMING);

  return {
    limit: DASHBOARD_LIMITS.UPCOMING,
    items: rows.map((row) => ({
      contentItemId: row.contentItemId,
      versionId: row.versionId,
      title: row.title,
      scheduledAt: iso(row.scheduledAt)!,
      primaryCategory:
        row.primaryCategoryId && row.primaryCategoryName && row.primaryCategorySlug
          ? {
              id: row.primaryCategoryId,
              name: row.primaryCategoryName,
              slug: row.primaryCategorySlug,
            }
          : null,
      targetHref: contentHref(row.contentItemId),
    })),
  };
}

async function loadReviewSummary(): Promise<SuperAdminReviewSummary> {
  const db = getDb();
  const [countRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(contentVersions)
    .innerJoin(contentItems, sql`${contentItems.id} = ${contentVersions.contentItemId}`)
    .where(sql`${contentItems.deletedAt} is null
      and ${contentVersions.workflowStatus} = ${WORKFLOW_STATUS.IN_REVIEW}`);
  const [changesRow] = await db
    .select({
      changesRequested: sql<number>`count(*)::int`,
    })
    .from(contentItems)
    .where(sql`${contentItems.deletedAt} is null and ${changesRequestedOnDraftSql()}`);

  const queue = await listReviewQueue(
    { scopedCategoryIds: null },
    { limit: DASHBOARD_LIMITS.REVIEW },
  );

  return {
    count: Number(countRow?.count ?? 0),
    changesRequested: Number(changesRow?.changesRequested ?? 0),
    items: queue.items.map((item) => ({
      contentItemId: item.contentItemId,
      versionId: item.versionId,
      title: item.title,
      latestSubmittedAt: item.latestSubmittedAt.toISOString(),
      reviewRound: item.reviewRound,
      primaryCategory: item.primaryCategory,
      targetHref: reviewHref(item.contentItemId, item.versionId),
    })),
    targetHref: "/review",
  };
}

async function loadAnalyticsSummary(
  scope: EditorStaffScope,
  period: AnalyticsReportingPeriod,
): Promise<SuperAdminAnalyticsSummary> {
  const [
    overview,
    articleViewsSeries,
    homepageImpressionsSeries,
    topContent,
    sources,
    categoryPerformance,
    authorPerformance,
    homepageSlots,
  ] = await Promise.all([
    getAnalyticsOverview({ period, scope, comparePrevious: true }),
    getAnalyticsTimeSeries({
      period,
      scope,
      metric: ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS,
    }),
    getAnalyticsTimeSeries({
      period,
      scope,
      metric: ANALYTICS_REPORTING_METRIC.HOMEPAGE_IMPRESSIONS,
    }),
    getAnalyticsContentPerformance({
      period,
      scope,
      sort: ANALYTICS_CONTENT_SORT.ARTICLE_VIEWS,
      limit: DASHBOARD_LIMITS.PERFORMANCE,
      minImpressions: 1,
    }),
    getAnalyticsSources({ period, scope }),
    getAnalyticsCategories({ period, scope }),
    getAnalyticsAuthors({ period, scope }),
    getAnalyticsHomepageSlots({ period, scope }),
  ]);
  if (
    overview.freshness.status !== "AVAILABLE" ||
    articleViewsSeries.freshness.status !== "AVAILABLE" ||
    homepageImpressionsSeries.freshness.status !== "AVAILABLE"
  ) {
    throw new Error("ANALYTICS_UNAVAILABLE");
  }
  const homepageByBucket = new Map(
    homepageImpressionsSeries.points.map((point) => [
      point.bucketStart.toISOString(),
      point.value ?? 0,
    ]),
  );
  const categoryTotal = categoryPerformance.items.reduce(
    (sum, item) => sum + item.articleViews,
    0,
  );
  const sourceTotal = sources.total;
  return {
    period: {
      fromInclusive: period.fromInclusive.toISOString(),
      toExclusive: period.toExclusive.toISOString(),
      granularity: ANALYTICS_TIME_BUCKET.DAY,
      timezone: ANALYTICS_REPORTING_TIMEZONE,
    },
    freshness: overview.freshness,
    metricAvailability: overview.metricAvailability,
    metrics: {
      articleViews: overview.metrics.articleViews,
      homepageImpressions: overview.metrics.homepageImpressions,
      homepageClicks: overview.metrics.homepageClicks,
      homepageCtr: overview.metrics.homepageCtr,
    },
    comparison: overview.comparison,
    timeSeries: articleViewsSeries.points.map((point) => ({
      bucketStart: point.bucketStart.toISOString(),
      articleViews: point.value ?? 0,
      homepageImpressions: homepageByBucket.get(point.bucketStart.toISOString()) ?? 0,
    })),
    topContent: topContent.items.slice(0, DASHBOARD_LIMITS.PERFORMANCE).map((item) => ({
      contentItemId: item.contentItemId,
      title: item.display?.title ?? "Başlıksız içerik",
      primaryCategoryName: item.display?.primaryCategoryName ?? null,
      authorNames: item.display?.authors.map((author) => author.displayName) ?? [],
      articleViews: item.articleViews,
      homepageClicks: item.homepageClicks,
      homepageCtr: item.homepageCtr,
      targetHref: contentHref(item.contentItemId),
    })),
    trafficSources: sources.items
      .slice(0, DASHBOARD_LIMITS.PERFORMANCE)
      .map((item) => ({
        sourceChannel: item.sourceChannel,
        eventCount: item.eventCount,
        share: sourceTotal > 0 ? item.eventCount / sourceTotal : null,
      })),
    categories: categoryPerformance.items
      .slice(0, DASHBOARD_LIMITS.PERFORMANCE)
      .map((item) => ({
        categoryId: item.categoryId,
        name: item.name,
        articleViews: item.articleViews,
        contentCount: item.contentCount,
        share: categoryTotal > 0 ? item.articleViews / categoryTotal : null,
      })),
    authors: authorPerformance.items
      .slice(0, DASHBOARD_LIMITS.PERFORMANCE)
      .map((item) => ({
        authorId: item.authorId,
        displayName: item.displayName,
        articleViews: item.articleViews,
        contentCount: item.contentCount,
      })),
    homepageSlots: homepageSlots.items
      .sort((left, right) => right.impressions - left.impressions)
      .slice(0, DASHBOARD_LIMITS.PERFORMANCE)
      .map((item) => ({
        placement: item.placement,
        position: item.position,
        title: item.display?.title ?? null,
        impressions: item.impressions,
        clicks: item.clicks,
        ctr: item.ctr,
      })),
  };
}

async function loadLegalSummary(): Promise<SuperAdminLegalSummary> {
  const db = getDb();
  const [countRow] = await db
    .select({
      activeHolds: sql<number>`count(*) filter (where ${contentItems.legalHoldAt} is not null)::int`,
      activeTakedowns: sql<number>`count(*) filter (where ${contentItems.takedownAt} is not null)::int`,
      activeRetractions: sql<number>`count(*) filter (where ${contentItems.retractedAt} is not null)::int`,
      corrections: sql<number>`(
        select count(*)::int
        from ${contentLegalActions}
        where ${contentLegalActions.actionType} = ${CONTENT_LEGAL_ACTION_TYPE.CORRECTION}
      )`,
    })
    .from(contentItems)
    .where(sql`${contentItems.deletedAt} is null`);
  const legalDashboard = await listLegalDashboard({
    limit: DASHBOARD_LIMITS.LEGAL,
    cursor: null,
  });

  return {
    activeHolds: Number(countRow?.activeHolds ?? 0),
    activeTakedowns: Number(countRow?.activeTakedowns ?? 0),
    activeRetractions: Number(countRow?.activeRetractions ?? 0),
    corrections: Number(countRow?.corrections ?? 0),
    recentActions: legalDashboard.entries.map((entry) => ({
      actionId: entry.actionId,
      contentItemId: entry.contentItemId,
      articleTitle: entry.articleTitle,
      actionType: entry.actionType,
      effectiveAt: entry.effectiveAt.toISOString(),
      createdAt: entry.createdAt.toISOString(),
      targetHref: contentHref(entry.contentItemId),
    })),
    activeHoldItems: legalDashboard.activeHolds
      .slice(0, DASHBOARD_LIMITS.LEGAL)
      .map((hold) => ({
        contentItemId: hold.contentItemId,
        title: hold.title,
        legalHoldAt: hold.legalHoldAt.toISOString(),
        publicationStatus: hold.publicationStatus,
        targetHref: contentHref(hold.contentItemId),
      })),
  };
}

async function loadStaffSecuritySummary(): Promise<SuperAdminStaffSecuritySummary> {
  const db = getDb();
  const rows = await db
    .select({
      id: staffUsers.id,
      status: staffUsers.status,
      role: staffUserRoles.role,
      mfaStatus: staffMfaFactors.status,
    })
    .from(staffUsers)
    .leftJoin(staffUserRoles, sql`${staffUserRoles.staffUserId} = ${staffUsers.id}`)
    .leftJoin(staffMfaFactors, sql`${staffMfaFactors.staffUserId} = ${staffUsers.id}`);

  const byStaff = new Map<
    string,
    { status: string; roles: Set<string>; mfaConfigured: boolean }
  >();
  for (const row of rows) {
    const entry =
      byStaff.get(row.id) ??
      { status: row.status, roles: new Set<string>(), mfaConfigured: false };
    if (row.role) {
      entry.roles.add(row.role);
    }
    if (row.mfaStatus === STAFF_MFA_FACTOR_STATUS.ACTIVE) {
      entry.mfaConfigured = true;
    }
    byStaff.set(row.id, entry);
  }
  const staff = [...byStaff.values()];
  const mfaConfigured = staff.filter((entry) => entry.mfaConfigured).length;

  return {
    total: staff.length,
    active: staff.filter((entry) => entry.status === STAFF_STATUS.ACTIVE).length,
    disabled: staff.filter((entry) => entry.status === STAFF_STATUS.DISABLED).length,
    superAdmin: staff.filter((entry) => entry.roles.has(STAFF_ROLE.SUPER_ADMIN)).length,
    mfaConfigured,
    mfaNotConfigured: staff.length - mfaConfigured,
  };
}

async function loadHomepageStatus(): Promise<SuperAdminHomepageStatus> {
  const db = getDb();
  const [row] = await db
    .select({
      liveVersionId: homepages.publishedVersionId,
      draftVersionId: homepages.draftVersionId,
      lastPublishedAt: homepageVersions.publishedAt,
    })
    .from(homepages)
    .leftJoin(homepageVersions, sql`${homepageVersions.id} = ${homepages.publishedVersionId}`)
    .limit(1);

  const [publishedSlots] = row?.liveVersionId
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(homepageSlots)
        .where(sql`${homepageSlots.homepageVersionId} = ${row.liveVersionId}
          and ${homepageSlots.contentItemId} is not null`)
    : [{ count: 0 }];
  const [draftSlots] = row?.draftVersionId
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(homepageSlots)
        .where(sql`${homepageSlots.homepageVersionId} = ${row.draftVersionId}
          and ${homepageSlots.contentItemId} is not null`)
    : [{ count: 0 }];

  return {
    liveVersionId: row?.liveVersionId ?? null,
    lastPublishedAt: iso(row?.lastPublishedAt ?? null),
    unpublishedDraftExists: Boolean(
      row?.draftVersionId &&
        (!row.liveVersionId || row.draftVersionId !== row.liveVersionId),
    ),
    publishedSlotCount: Number(publishedSlots?.count ?? 0),
    draftSlotCount: Number(draftSlots?.count ?? 0),
  };
}

async function loadSeoSummary(scope: EditorStaffScope): Promise<SuperAdminSeoSummary> {
  const summary = await summarizeSeoInspections({ scope });
  return {
    accessibleCount: summary.accessibleCount,
    errorCount: summary.errorCount,
    warningCount: summary.warningCount,
    missingMetaDescriptionCount: summary.missingMetaDescriptionCount,
    missingHeroCount: summary.missingHeroCount,
    notIndexableCount: summary.notIndexableCount,
    healthyPublishedCount: summary.healthyPublishedCount,
    measurements: summary.measurements,
  };
}

async function loadSystemSignals(): Promise<SuperAdminSystemSignals> {
  const [outbox, analyticsFreshness] = await Promise.all([
    countPublicCacheOutboxEventsByStatus(),
    getAnalyticsFreshness(),
  ]);
  return {
    publicCacheOutbox: {
      pending: outbox.PENDING,
      processing: outbox.PROCESSING,
      completed: outbox.COMPLETED,
      dead: outbox.DEAD,
      // Public cache outbox has no FAILED status. Transient failures return to
      // PENDING; terminal failures are DEAD. `failed` is the presentation alias.
      failed: outbox.DEAD,
    },
    analyticsFreshness,
  };
}
