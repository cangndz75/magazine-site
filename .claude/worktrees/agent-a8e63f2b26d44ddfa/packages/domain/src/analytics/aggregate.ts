import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_TRAFFIC_KIND,
  type AnalyticsEventName,
  type AnalyticsPlacement,
  type AnalyticsSurface,
  type AnalyticsTrafficKind,
  type AnalyticsTrafficSource,
} from "./taxonomy";
import {
  analyticsFactIsMetricEligible,
  analyticsSchemaVersionIsSupported,
  ANALYTICS_AUTHOR_ATTRIBUTION,
} from "./aggregation-policy";
import { utcHourBucketStart, reportingDayBucketStart } from "./buckets";

export type AnalyticsAggregateFact = {
  eventId: string;
  schemaVersion: number;
  eventName: AnalyticsEventName;
  occurredAt: Date;
  anonymousSessionId: string | null;
  trafficKind: AnalyticsTrafficKind;
  trafficSource: AnalyticsTrafficSource;
  referrerHost: string | null;
  contentItemId: string | null;
  publishedVersionId: string | null;
  surface: AnalyticsSurface;
  placement: AnalyticsPlacement | null;
  homepageVersionId: string | null;
  position: number | null;
  mediaId: string | null;
  videoAssetId: string | null;
  primaryCategoryId: string | null;
  authorIds: readonly string[] | null;
};

export type AnalyticsContentAggregateRow = {
  bucketStart: Date;
  contentItemId: string;
  publishedVersionId: string;
  articleViews: number;
  galleryOpens: number;
  galleryImageViews: number;
  videoImpressions: number;
  homepageImpressions: number;
  homepageClicks: number;
};

export type AnalyticsHomepageSlotAggregateRow = {
  bucketStart: Date;
  homepageVersionId: string | null;
  placement: AnalyticsPlacement;
  position: number;
  contentItemId: string;
  impressions: number;
  clicks: number;
};

export type AnalyticsSourceAggregateRow = {
  bucketStart: Date;
  trafficSource: AnalyticsTrafficSource;
  referrerHost: string | null;
  contentItemId: string | null;
  eventCount: number;
};

export type AnalyticsCategoryAggregateRow = {
  bucketStart: Date;
  primaryCategoryId: string;
  contentItemId: string;
  articleViews: number;
};

export type AnalyticsAuthorAggregateRow = {
  bucketStart: Date;
  authorId: string;
  contentItemId: string;
  articleViews: number;
};

export type AnalyticsMediaAggregateRow = {
  bucketStart: Date;
  contentItemId: string;
  mediaId: string;
  galleryOpens: number;
  galleryImageViews: number;
};

export type AnalyticsVideoAggregateRow = {
  bucketStart: Date;
  videoAssetId: string;
  surface: AnalyticsSurface;
  contentItemId: string | null;
  homepageVersionId: string | null;
  impressions: number;
};

export type AnalyticsSessionAggregateRow = {
  bucketStart: Date;
  anonymousSessionId: string;
  contentItemId: string | null;
};

export type AnalyticsAggregationQuality = {
  rawCountProcessed: number;
  duplicateEventIdsSkipped: number;
  unsupportedSchemaVersionCount: number;
  eligibleCount: number;
  excludedBotCount: number;
  excludedInternalCount: number;
  excludedTestCount: number;
  excludedUnknownCount: number;
  missingContentDimensionCount: number;
  missingCategorySnapshotCount: number;
  missingAuthorSnapshotCount: number;
  clickWithoutImpressionAnomalyCount: number;
  clickGreaterThanImpressionAnomalyCount: number;
  videoPlayEventsIgnored: number;
};

export type AnalyticsAggregateBatch = {
  contentHourly: AnalyticsContentAggregateRow[];
  contentDaily: AnalyticsContentAggregateRow[];
  homepageSlotHourly: AnalyticsHomepageSlotAggregateRow[];
  homepageSlotDaily: AnalyticsHomepageSlotAggregateRow[];
  sourceDaily: AnalyticsSourceAggregateRow[];
  categoryDaily: AnalyticsCategoryAggregateRow[];
  authorDaily: AnalyticsAuthorAggregateRow[];
  mediaDaily: AnalyticsMediaAggregateRow[];
  videoDaily: AnalyticsVideoAggregateRow[];
  sessionDaily: AnalyticsSessionAggregateRow[];
  quality: AnalyticsAggregationQuality;
};

void ANALYTICS_AUTHOR_ATTRIBUTION;

function emptyQuality(): AnalyticsAggregationQuality {
  return {
    rawCountProcessed: 0,
    duplicateEventIdsSkipped: 0,
    unsupportedSchemaVersionCount: 0,
    eligibleCount: 0,
    excludedBotCount: 0,
    excludedInternalCount: 0,
    excludedTestCount: 0,
    excludedUnknownCount: 0,
    missingContentDimensionCount: 0,
    missingCategorySnapshotCount: 0,
    missingAuthorSnapshotCount: 0,
    clickWithoutImpressionAnomalyCount: 0,
    clickGreaterThanImpressionAnomalyCount: 0,
    videoPlayEventsIgnored: 0,
  };
}

function bumpExcluded(
  quality: AnalyticsAggregationQuality,
  kind: AnalyticsTrafficKind,
): void {
  if (kind === ANALYTICS_TRAFFIC_KIND.BOT) {
    quality.excludedBotCount += 1;
    return;
  }
  if (kind === ANALYTICS_TRAFFIC_KIND.INTERNAL) {
    quality.excludedInternalCount += 1;
    return;
  }
  if (kind === ANALYTICS_TRAFFIC_KIND.TEST) {
    quality.excludedTestCount += 1;
    return;
  }
  quality.excludedUnknownCount += 1;
}

function contentKey(
  bucketStart: Date,
  contentItemId: string,
  publishedVersionId: string,
): string {
  return `${bucketStart.toISOString()}|${contentItemId}|${publishedVersionId}`;
}

function emptyContentRow(
  bucketStart: Date,
  contentItemId: string,
  publishedVersionId: string,
): AnalyticsContentAggregateRow {
  return {
    bucketStart,
    contentItemId,
    publishedVersionId,
    articleViews: 0,
    galleryOpens: 0,
    galleryImageViews: 0,
    videoImpressions: 0,
    homepageImpressions: 0,
    homepageClicks: 0,
  };
}

function contentRow(
  map: Map<string, AnalyticsContentAggregateRow>,
  bucketStart: Date,
  contentItemId: string,
  publishedVersionId: string,
): AnalyticsContentAggregateRow {
  const key = contentKey(bucketStart, contentItemId, publishedVersionId);
  const existing = map.get(key);
  if (existing) {
    return existing;
  }
  const created = emptyContentRow(bucketStart, contentItemId, publishedVersionId);
  map.set(key, created);
  return created;
}

function homepageKey(
  bucketStart: Date,
  homepageVersionId: string | null,
  placement: AnalyticsPlacement,
  position: number,
  contentItemId: string,
): string {
  return `${bucketStart.toISOString()}|${homepageVersionId ?? ""}|${placement}|${position}|${contentItemId}`;
}

function sourceKey(
  bucketStart: Date,
  trafficSource: AnalyticsTrafficSource,
  referrerHost: string | null,
  contentItemId: string | null,
): string {
  return `${bucketStart.toISOString()}|${trafficSource}|${referrerHost ?? ""}|${contentItemId ?? ""}`;
}

function sortedRows<T>(
  map: Map<string, T>,
): T[] {
  return [...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, row]) => row);
}

function recordClickImpressionAnomalies(
  rows: AnalyticsHomepageSlotAggregateRow[],
  quality: AnalyticsAggregationQuality,
): void {
  for (const row of rows) {
    if (row.clicks > 0 && row.impressions <= 0) {
      quality.clickWithoutImpressionAnomalyCount += 1;
    }
    if (row.clicks > row.impressions) {
      quality.clickGreaterThanImpressionAnomalyCount += 1;
    }
  }
}

/**
 * Recompute exact aggregate rows for a set of raw facts.
 * Callers must replace the window keyspace; this function never increments
 * previously stored counters.
 */
export function computeAnalyticsAggregates(
  facts: readonly AnalyticsAggregateFact[],
): AnalyticsAggregateBatch {
  const quality = emptyQuality();
  const seenEventIds = new Set<string>();
  const contentHourly = new Map<string, AnalyticsContentAggregateRow>();
  const contentDaily = new Map<string, AnalyticsContentAggregateRow>();
  const homepageHourly = new Map<string, AnalyticsHomepageSlotAggregateRow>();
  const homepageDaily = new Map<string, AnalyticsHomepageSlotAggregateRow>();
  const sourceDaily = new Map<string, AnalyticsSourceAggregateRow>();
  const categoryDaily = new Map<string, AnalyticsCategoryAggregateRow>();
  const authorDaily = new Map<string, AnalyticsAuthorAggregateRow>();
  const mediaDaily = new Map<string, AnalyticsMediaAggregateRow>();
  const videoDaily = new Map<string, AnalyticsVideoAggregateRow>();
  const sessionDaily = new Map<string, AnalyticsSessionAggregateRow>();

  for (const fact of facts) {
    quality.rawCountProcessed += 1;
    if (seenEventIds.has(fact.eventId)) {
      quality.duplicateEventIdsSkipped += 1;
      continue;
    }
    seenEventIds.add(fact.eventId);

    if (!analyticsSchemaVersionIsSupported(fact.schemaVersion)) {
      quality.unsupportedSchemaVersionCount += 1;
      continue;
    }

    if (fact.eventName === ANALYTICS_EVENT_NAME.VIDEO_PLAY) {
      quality.videoPlayEventsIgnored += 1;
    }

    if (!analyticsFactIsMetricEligible(fact.trafficKind)) {
      bumpExcluded(quality, fact.trafficKind);
      continue;
    }

    quality.eligibleCount += 1;
    const hour = utcHourBucketStart(fact.occurredAt);
    const day = reportingDayBucketStart(fact.occurredAt);

    const sourceMapKey = sourceKey(
      day,
      fact.trafficSource,
      fact.referrerHost,
      fact.contentItemId,
    );
    const sourceRow = sourceDaily.get(sourceMapKey);
    if (sourceRow) {
      sourceRow.eventCount += 1;
    } else {
      sourceDaily.set(sourceMapKey, {
        bucketStart: day,
        trafficSource: fact.trafficSource,
        referrerHost: fact.referrerHost,
        contentItemId: fact.contentItemId,
        eventCount: 1,
      });
    }

    if (fact.anonymousSessionId) {
      const sessionKey = `${day.toISOString()}|${fact.anonymousSessionId}|${fact.contentItemId ?? ""}`;
      if (!sessionDaily.has(sessionKey)) {
        sessionDaily.set(sessionKey, {
          bucketStart: day,
          anonymousSessionId: fact.anonymousSessionId,
          contentItemId: fact.contentItemId,
        });
      }
    }

    if (
      fact.eventName === ANALYTICS_EVENT_NAME.ARTICLE_VIEW ||
      fact.eventName === ANALYTICS_EVENT_NAME.GALLERY_OPEN ||
      fact.eventName === ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW ||
      fact.eventName === ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION ||
      fact.eventName === ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK ||
      (fact.eventName === ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION &&
        fact.contentItemId &&
        fact.publishedVersionId)
    ) {
      if (!fact.contentItemId || !fact.publishedVersionId) {
        quality.missingContentDimensionCount += 1;
      } else {
        const hourly = contentRow(
          contentHourly,
          hour,
          fact.contentItemId,
          fact.publishedVersionId,
        );
        const daily = contentRow(
          contentDaily,
          day,
          fact.contentItemId,
          fact.publishedVersionId,
        );
        if (fact.eventName === ANALYTICS_EVENT_NAME.ARTICLE_VIEW) {
          hourly.articleViews += 1;
          daily.articleViews += 1;
          if (!fact.primaryCategoryId) {
            quality.missingCategorySnapshotCount += 1;
          } else {
            const categoryKey = `${day.toISOString()}|${fact.primaryCategoryId}|${fact.contentItemId}`;
            const categoryRow = categoryDaily.get(categoryKey);
            if (categoryRow) {
              categoryRow.articleViews += 1;
            } else {
              categoryDaily.set(categoryKey, {
                bucketStart: day,
                primaryCategoryId: fact.primaryCategoryId,
                contentItemId: fact.contentItemId,
                articleViews: 1,
              });
            }
          }
          const authorIds = fact.authorIds ?? [];
          if (authorIds.length === 0) {
            quality.missingAuthorSnapshotCount += 1;
          } else {
            for (const authorId of authorIds) {
              const authorKey = `${day.toISOString()}|${authorId}|${fact.contentItemId}`;
              const authorRow = authorDaily.get(authorKey);
              if (authorRow) {
                authorRow.articleViews += 1;
              } else {
                authorDaily.set(authorKey, {
                  bucketStart: day,
                  authorId,
                  contentItemId: fact.contentItemId,
                  articleViews: 1,
                });
              }
            }
          }
        } else if (fact.eventName === ANALYTICS_EVENT_NAME.GALLERY_OPEN) {
          hourly.galleryOpens += 1;
          daily.galleryOpens += 1;
        } else if (fact.eventName === ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW) {
          hourly.galleryImageViews += 1;
          daily.galleryImageViews += 1;
        } else if (
          fact.eventName === ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION
        ) {
          hourly.homepageImpressions += 1;
          daily.homepageImpressions += 1;
        } else if (fact.eventName === ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK) {
          hourly.homepageClicks += 1;
          daily.homepageClicks += 1;
        } else if (fact.eventName === ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION) {
          hourly.videoImpressions += 1;
          daily.videoImpressions += 1;
        }
      }
    }

    if (
      (fact.eventName === ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION ||
        fact.eventName === ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK) &&
      fact.contentItemId &&
      fact.placement &&
      fact.position !== null
    ) {
      const bump = (
        map: Map<string, AnalyticsHomepageSlotAggregateRow>,
        bucketStart: Date,
      ) => {
        const key = homepageKey(
          bucketStart,
          fact.homepageVersionId,
          fact.placement as AnalyticsPlacement,
          fact.position as number,
          fact.contentItemId as string,
        );
        const existing = map.get(key);
        const row =
          existing ??
          {
            bucketStart,
            homepageVersionId: fact.homepageVersionId,
            placement: fact.placement as AnalyticsPlacement,
            position: fact.position as number,
            contentItemId: fact.contentItemId as string,
            impressions: 0,
            clicks: 0,
          };
        if (fact.eventName === ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION) {
          row.impressions += 1;
        } else {
          row.clicks += 1;
        }
        map.set(key, row);
      };
      bump(homepageHourly, hour);
      bump(homepageDaily, day);
    }

    if (
      (fact.eventName === ANALYTICS_EVENT_NAME.GALLERY_OPEN ||
        fact.eventName === ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW) &&
      fact.contentItemId &&
      fact.mediaId
    ) {
      const mediaKey = `${day.toISOString()}|${fact.contentItemId}|${fact.mediaId}`;
      const existing = mediaDaily.get(mediaKey);
      const row =
        existing ??
        {
          bucketStart: day,
          contentItemId: fact.contentItemId,
          mediaId: fact.mediaId,
          galleryOpens: 0,
          galleryImageViews: 0,
        };
      if (fact.eventName === ANALYTICS_EVENT_NAME.GALLERY_OPEN) {
        row.galleryOpens += 1;
      } else {
        row.galleryImageViews += 1;
      }
      mediaDaily.set(mediaKey, row);
    }

    if (
      fact.eventName === ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION &&
      fact.videoAssetId
    ) {
      const videoKey = `${day.toISOString()}|${fact.videoAssetId}|${fact.surface}|${fact.contentItemId ?? ""}|${fact.homepageVersionId ?? ""}`;
      const existing = videoDaily.get(videoKey);
      if (existing) {
        existing.impressions += 1;
      } else {
        videoDaily.set(videoKey, {
          bucketStart: day,
          videoAssetId: fact.videoAssetId,
          surface: fact.surface,
          contentItemId: fact.contentItemId,
          homepageVersionId: fact.homepageVersionId,
          impressions: 1,
        });
      }
    }
  }

  const homepageSlotHourly = sortedRows(homepageHourly);
  const homepageSlotDaily = sortedRows(homepageDaily);
  recordClickImpressionAnomalies(homepageSlotDaily, quality);

  return {
    contentHourly: sortedRows(contentHourly),
    contentDaily: sortedRows(contentDaily),
    homepageSlotHourly,
    homepageSlotDaily,
    sourceDaily: sortedRows(sourceDaily),
    categoryDaily: sortedRows(categoryDaily),
    authorDaily: sortedRows(authorDaily),
    mediaDaily: sortedRows(mediaDaily),
    videoDaily: sortedRows(videoDaily),
    sessionDaily: sortedRows(sessionDaily),
    quality,
  };
}
