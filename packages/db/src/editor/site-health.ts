import { sql } from "drizzle-orm";
import {
  MEDIA_LICENSE_TYPE,
  MEDIA_RIGHTS_STATUS,
  MEDIA_SOURCE_KIND,
  MEDIA_USAGE_RESTRICTION,
  SITE_HEALTH_STATUS,
  assertSafeSiteHealthDto,
  authorizeSiteHealthRead,
  deriveSiteHealthOverallStatus,
  type EditorStaffScope,
  type SiteHealthDto,
  type SiteHealthSection,
  type SiteHealthStatus,
} from "@magazine/domain";
import { getAnalyticsFreshness } from "../analytics/report";
import { getDb } from "../client";
import { getFeatureControlOperationalSummary } from "../feature-controls";
import { countPublicCacheOutboxEventsByStatus } from "../public-cache-outbox";
import { summarizeSeoInspections } from "../seo/inspection";
import { contentItems } from "../schema/content";
import {
  homepageSlots,
  homepageVersions,
  homepages,
} from "../schema/homepage-builder";
import { homepageConversationItems } from "../schema/homepage-conversation";
import { media } from "../schema/media";

export type SiteHealthInput = {
  scope: EditorStaffScope;
  now?: Date;
};

type Loader<TMetrics extends Record<string, unknown>> = () => Promise<
  SiteHealthSection<TMetrics>
>;

function iso(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function unavailableSection<TMetrics extends Record<string, unknown>>(
  label: string,
  metrics: TMetrics,
  summary = "Kaynak okunamadı; bu bölüm sıfır veri olarak yorumlanmamalı.",
): SiteHealthSection<TMetrics> {
  return {
    status: SITE_HEALTH_STATUS.UNAVAILABLE,
    availability: "UNAVAILABLE",
    label,
    summary,
    updatedAt: null,
    metrics,
    actionTarget: null,
  };
}

async function section<TMetrics extends Record<string, unknown>>(
  label: string,
  fallbackMetrics: TMetrics,
  loader: Loader<TMetrics>,
): Promise<SiteHealthSection<TMetrics>> {
  try {
    return await loader();
  } catch {
    return unavailableSection(label, fallbackMetrics);
  }
}

function statusLabel(status: SiteHealthStatus): string {
  switch (status) {
    case SITE_HEALTH_STATUS.UNAVAILABLE:
      return "Kullanılamıyor";
    case SITE_HEALTH_STATUS.ATTENTION:
      return "Dikkat gerekli";
    case SITE_HEALTH_STATUS.DEGRADED:
      return "Kısmi gözlem";
    default:
      return "Sağlıklı";
  }
}

function overallSummary(status: SiteHealthStatus): string {
  switch (status) {
    case SITE_HEALTH_STATUS.UNAVAILABLE:
      return "En az bir operasyonel sinyal okunamadı.";
    case SITE_HEALTH_STATUS.ATTENTION:
      return "En az bir operasyonel sinyal aksiyon gerektiriyor.";
    case SITE_HEALTH_STATUS.DEGRADED:
      return "Bazı sistemler yalnızca kısmi olarak gözlemlenebiliyor.";
    default:
      return "Okunabilen operasyonel sinyaller sağlıklı görünüyor.";
  }
}

export async function getSiteHealth(
  input: SiteHealthInput,
): Promise<SiteHealthDto> {
  const authorized = authorizeSiteHealthRead({ roles: input.scope.roles });
  if (!authorized.ok) {
    throw new Error(authorized.code);
  }

  const now = input.now ?? new Date();
  const [
    database,
    outbox,
    scheduledPublishing,
    analytics,
    seo,
    homepage,
    mediaSection,
    cache,
    featureControls,
  ] = await Promise.all([
    section("Veritabanı", { available: false, queryTimestamp: null }, () =>
      loadDatabaseHealth(),
    ),
    section("Outbox", { pending: null, processing: null, dead: null }, () =>
      loadOutboxHealth(),
    ),
    section(
      "Zamanlanmış yayın",
      { scheduledCount: null, overdueCount: null, nextScheduledAt: null },
      () => loadScheduledPublishingHealth(now),
    ),
    section(
      "Analytics",
      {
        availability: "UNAVAILABLE",
        reason: null,
        lastSuccessfulThrough: null,
        lastCompletedAt: null,
      },
      () => loadAnalyticsHealth(),
    ),
    section("SEO", { healthy: null, attention: null, critical: null }, () =>
      loadSeoHealth(input.scope),
    ),
    section(
      "Ana sayfa",
      {
        liveVersionAvailable: null,
        lastPublishedAt: null,
        publishedSlotCount: null,
        activeConversationItemCount: null,
      },
      () => loadHomepageHealth(),
    ),
    section(
      "Medya",
      { total: null, rightsIneligible: null, expiredLicenses: null, missingCredit: null },
      () => loadMediaHealth(now),
    ),
    section(
      "Cache / invalidation",
      {
        runtimeObservable: false,
        invalidationOutboxObservable: false,
        pending: null,
        processing: null,
        dead: null,
      },
      () => loadCacheHealth(),
    ),
    section(
      "Özellik kontrolleri",
      { featureFlagsDisabled: null, killSwitchesActive: null },
      () => loadFeatureControlsHealth(),
    ),
  ]);

  const overallStatus = deriveSiteHealthOverallStatus([
    database.status,
    outbox.status,
    scheduledPublishing.status,
    analytics.status,
    seo.status,
    homepage.status,
    mediaSection.status,
    cache.status,
    featureControls.status,
  ]);

  const dto: SiteHealthDto = {
    generatedAt: now.toISOString(),
    overall: {
      status: overallStatus,
      label: statusLabel(overallStatus),
      summary: overallSummary(overallStatus),
    },
    database,
    outbox,
    scheduledPublishing,
    analytics,
    seo,
    homepage,
    media: mediaSection,
    cache,
    featureControls,
  };

  assertSafeSiteHealthDto(dto);
  return dto;
}

async function loadFeatureControlsHealth(): Promise<
  SiteHealthSection<{
    featureFlagsDisabled: number | null;
    killSwitchesActive: number | null;
  }>
> {
  const summary = await getFeatureControlOperationalSummary();
  const needsAttention =
    summary.featureFlagsDisabled > 0 || summary.killSwitchesActive > 0;
  return {
    status: needsAttention ? SITE_HEALTH_STATUS.ATTENTION : SITE_HEALTH_STATUS.HEALTHY,
    availability: "AVAILABLE",
    label: "Özellik kontrolleri",
    summary: needsAttention
      ? summary.killSwitchesActive > 0
        ? "En az bir acil durum kontrolü aktif; normal davranış değişmiş olabilir."
        : "Bazı özellik bayrakları kapalı; ürün yüzeyleri kısıtlanmış olabilir."
    : "Çalışma zamanı kontrolleri varsayılan üretim durumunda.",
    updatedAt: summary.updatedAt,
    metrics: {
      featureFlagsDisabled: summary.featureFlagsDisabled,
      killSwitchesActive: summary.killSwitchesActive,
    },
    actionTarget: "/feature-controls",
  };
}

async function loadDatabaseHealth(): Promise<
  SiteHealthSection<{ available: boolean; queryTimestamp: string | null }>
> {
  const result = await getDb().execute(sql<{ queryTimestamp: Date }>`
    select now() as "queryTimestamp"
  `);
  const row = result.rows[0] as { queryTimestamp: Date } | undefined;
  const queryTimestamp = iso(row?.queryTimestamp ?? new Date());
  return {
    status: SITE_HEALTH_STATUS.HEALTHY,
    availability: "AVAILABLE",
    label: "Veritabanı",
    summary: "Sınırlı sağlık okuması veritabanından başarıyla döndü.",
    updatedAt: queryTimestamp,
    metrics: { available: true, queryTimestamp },
    actionTarget: null,
  };
}

async function loadOutboxHealth(): Promise<
  SiteHealthSection<{ pending: number | null; processing: number | null; dead: number | null }>
> {
  const outbox = await countPublicCacheOutboxEventsByStatus();
  return {
    status: outbox.DEAD > 0 ? SITE_HEALTH_STATUS.ATTENTION : SITE_HEALTH_STATUS.HEALTHY,
    availability: "AVAILABLE",
    label: "Outbox",
    summary:
      outbox.DEAD > 0
        ? "Terminal DEAD outbox kayıtları var."
        : "Outbox durum sayımları okunabiliyor.",
    updatedAt: null,
    metrics: {
      pending: outbox.PENDING,
      processing: outbox.PROCESSING,
      dead: outbox.DEAD,
    },
    actionTarget: null,
  };
}

async function loadScheduledPublishingHealth(
  now: Date,
): Promise<
  SiteHealthSection<{
    scheduledCount: number | null;
    overdueCount: number | null;
    nextScheduledAt: string | null;
  }>
> {
  const [row] = await getDb()
    .select({
      scheduledCount: sql<number>`count(*) filter (
        where ${contentItems.scheduledVersionId} is not null
      )::int`,
      overdueCount: sql<number>`count(*) filter (
        where ${contentItems.scheduledVersionId} is not null
          and ${contentItems.scheduledAt} < ${now}
      )::int`,
      nextScheduledAt: sql<Date | null>`min(${contentItems.scheduledAt}) filter (
        where ${contentItems.scheduledVersionId} is not null
          and ${contentItems.scheduledAt} >= ${now}
      )`,
    })
    .from(contentItems)
    .where(sql`${contentItems.deletedAt} is null`);

  const overdueCount = Number(row?.overdueCount ?? 0);
  return {
    status: overdueCount > 0 ? SITE_HEALTH_STATUS.ATTENTION : SITE_HEALTH_STATUS.HEALTHY,
    availability: "AVAILABLE",
    label: "Zamanlanmış yayın",
    summary:
      overdueCount > 0
        ? "Gecikmiş zamanlanmış yayın var."
        : "Zamanlanmış yayın göstergeleri okunabiliyor.",
    updatedAt: iso(row?.nextScheduledAt ?? null),
    metrics: {
      scheduledCount: Number(row?.scheduledCount ?? 0),
      overdueCount,
      nextScheduledAt: iso(row?.nextScheduledAt ?? null),
    },
    actionTarget: "/calendar",
  };
}

async function loadAnalyticsHealth(): Promise<
  SiteHealthSection<{
    availability: "AVAILABLE" | "UNAVAILABLE";
    reason: string | null;
    lastSuccessfulThrough: string | null;
    lastCompletedAt: string | null;
  }>
> {
  const freshness = await getAnalyticsFreshness();
  if (freshness.status === "UNAVAILABLE") {
    return {
      status: SITE_HEALTH_STATUS.UNAVAILABLE,
      availability: "UNAVAILABLE",
      label: "Analytics",
      summary: "Analytics agregasyonu mevcut değil; bu durum sıfır trafik değildir.",
      updatedAt: iso(freshness.lastSuccessfulThrough),
      metrics: {
        availability: "UNAVAILABLE",
        reason: freshness.reason,
        lastSuccessfulThrough: iso(freshness.lastSuccessfulThrough),
        lastCompletedAt: null,
      },
      actionTarget: "/analytics",
    };
  }

  return {
    status: SITE_HEALTH_STATUS.HEALTHY,
    availability: "AVAILABLE",
    label: "Analytics",
    summary: "Analytics agregasyon tazeliği okunabiliyor.",
    updatedAt: iso(freshness.lastCompletedAt),
    metrics: {
      availability: "AVAILABLE",
      reason: null,
      lastSuccessfulThrough: iso(freshness.lastSuccessfulThrough),
      lastCompletedAt: iso(freshness.lastCompletedAt),
    },
    actionTarget: "/analytics",
  };
}

async function loadSeoHealth(
  scope: EditorStaffScope,
): Promise<
  SiteHealthSection<{ healthy: number | null; attention: number | null; critical: number | null }>
> {
  const summary = await summarizeSeoInspections({ scope });
  const critical = summary.errorCount;
  const attention = summary.warningCount;
  return {
    status:
      critical > 0
        ? SITE_HEALTH_STATUS.ATTENTION
        : attention > 0
          ? SITE_HEALTH_STATUS.DEGRADED
          : SITE_HEALTH_STATUS.HEALTHY,
    availability: "AVAILABLE",
    label: "SEO",
    summary: "SEO denetim özetleri mevcut sözleşmeden okunuyor.",
    updatedAt: null,
    metrics: {
      healthy: summary.healthyPublishedCount,
      attention,
      critical,
    },
    actionTarget: "/seo",
  };
}

async function loadHomepageHealth(): Promise<
  SiteHealthSection<{
    liveVersionAvailable: boolean | null;
    lastPublishedAt: string | null;
    publishedSlotCount: number | null;
    activeConversationItemCount: number | null;
  }>
> {
  const db = getDb();
  const [state] = await db
    .select({
      liveVersionId: homepages.publishedVersionId,
      lastPublishedAt: homepageVersions.publishedAt,
    })
    .from(homepages)
    .leftJoin(homepageVersions, sql`${homepageVersions.id} = ${homepages.publishedVersionId}`)
    .limit(1);
  const [slotRow] = state?.liveVersionId
    ? await db
        .select({ count: sql<number>`count(*)::int` })
        .from(homepageSlots)
        .where(sql`${homepageSlots.homepageVersionId} = ${state.liveVersionId}
          and ${homepageSlots.contentItemId} is not null`)
    : [{ count: 0 }];
  const [conversationRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(homepageConversationItems)
    .where(sql`${homepageConversationItems.isActive} = true`);

  const liveVersionAvailable = Boolean(state?.liveVersionId);
  return {
    status: liveVersionAvailable ? SITE_HEALTH_STATUS.HEALTHY : SITE_HEALTH_STATUS.DEGRADED,
    availability: "AVAILABLE",
    label: "Ana sayfa",
    summary: liveVersionAvailable
      ? "Yayınlanmış ana sayfa durumu okunabiliyor."
      : "Yayınlanmış ana sayfa versiyonu yok.",
    updatedAt: iso(state?.lastPublishedAt ?? null),
    metrics: {
      liveVersionAvailable,
      lastPublishedAt: iso(state?.lastPublishedAt ?? null),
      publishedSlotCount: Number(slotRow?.count ?? 0),
      activeConversationItemCount: Number(conversationRow?.count ?? 0),
    },
    actionTarget: "/homepage",
  };
}

async function loadMediaHealth(
  now: Date,
): Promise<
  SiteHealthSection<{
    total: number | null;
    rightsIneligible: number | null;
    expiredLicenses: number | null;
    missingCredit: number | null;
  }>
> {
  const nowIso = now.toISOString();
  const [row] = await getDb()
    .select({
      total: sql<number>`count(*)::int`,
      rightsIneligible: sql<number>`count(*) filter (
        where ${media.sourceKind} = ${MEDIA_SOURCE_KIND.UNKNOWN}
          or ${media.licenseType} = ${MEDIA_LICENSE_TYPE.UNKNOWN}
          or ${media.rightsHolder} is null
          or ${media.creditLine} is null
          or ${media.usageRestriction} = ${MEDIA_USAGE_RESTRICTION.RESTRICTED}
          or (${media.licenseExpiresAt} is not null and ${media.licenseExpiresAt} <= ${nowIso}::timestamptz)
          or (${media.licenseStartsAt} is not null and ${media.licenseStartsAt} > ${nowIso}::timestamptz)
      )::int`,
      expiredLicenses: sql<number>`count(*) filter (
        where ${media.licenseExpiresAt} is not null
          and ${media.licenseExpiresAt} <= ${nowIso}::timestamptz
      )::int`,
      missingCredit: sql<number>`count(*) filter (where ${media.creditLine} is null)::int`,
    })
    .from(media);

  const rightsIneligible = Number(row?.rightsIneligible ?? 0);
  return {
    status: rightsIneligible > 0 ? SITE_HEALTH_STATUS.ATTENTION : SITE_HEALTH_STATUS.HEALTHY,
    availability: "AVAILABLE",
    label: "Medya",
    summary:
      rightsIneligible > 0
        ? "Kamusal kullanım için hak bilgisi uygun olmayan medya var."
        : "Medya hak özetleri okunabiliyor.",
    updatedAt: null,
    metrics: {
      total: Number(row?.total ?? 0),
      rightsIneligible,
      expiredLicenses: Number(row?.expiredLicenses ?? 0),
      missingCredit: Number(row?.missingCredit ?? 0),
    },
    actionTarget: `/media?rightsStatus=${MEDIA_RIGHTS_STATUS.INCOMPLETE}`,
  };
}

async function loadCacheHealth(): Promise<
  SiteHealthSection<{
    runtimeObservable: boolean;
    invalidationOutboxObservable: boolean;
    pending: number | null;
    processing: number | null;
    dead: number | null;
  }>
> {
  const outbox = await countPublicCacheOutboxEventsByStatus();
  return {
    status: outbox.DEAD > 0 ? SITE_HEALTH_STATUS.ATTENTION : SITE_HEALTH_STATUS.DEGRADED,
    availability: "PARTIAL",
    label: "Cache / invalidation",
    summary:
      outbox.DEAD > 0
        ? "Runtime cache sağlığı gözlemlenemiyor; invalidation outbox içinde DEAD kayıt var."
        : "Runtime cache sağlığı gözlemlenemiyor; yalnızca invalidation outbox sayımları mevcut.",
    updatedAt: null,
    metrics: {
      runtimeObservable: false,
      invalidationOutboxObservable: true,
      pending: outbox.PENDING,
      processing: outbox.PROCESSING,
      dead: outbox.DEAD,
    },
    actionTarget: null,
  };
}
