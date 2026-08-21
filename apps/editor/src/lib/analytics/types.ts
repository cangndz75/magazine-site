export type AnalyticsFreshnessDto =
  | { status: "AVAILABLE"; lastSuccessfulThrough: string; lastCompletedAt: string }
  | {
      status: "UNAVAILABLE";
      reason: "AGGREGATION_PENDING" | "AGGREGATION_FAILED";
      lastSuccessfulThrough: string | null;
      lastErrorSafeSummary: string | null;
    };

export type AnalyticsMetricAvailabilityDto =
  | { status: "AVAILABLE" }
  | { status: "UNAVAILABLE"; reason: string };

export type AnalyticsComparisonDto = {
  current: number;
  previous: number;
  delta: number;
  percentageChange: number | null;
};

export type AnalyticsOverviewDto = {
  freshness: AnalyticsFreshnessDto;
  metricAvailability: {
    ARTICLE_VIEWS: AnalyticsMetricAvailabilityDto;
    HOMEPAGE_IMPRESSIONS: AnalyticsMetricAvailabilityDto;
    SESSIONS: AnalyticsMetricAvailabilityDto;
    UNIQUE_VISITORS: AnalyticsMetricAvailabilityDto;
    VIDEO_PLAYS: AnalyticsMetricAvailabilityDto;
  };
  metrics: {
    articleViews: number;
    homepageImpressions: number;
    homepageClicks: number;
    homepageCtr: number | null;
    galleryOpens: number;
    galleryImageViews: number;
    videoImpressions: number;
  };
  comparison: {
    articleViews: AnalyticsComparisonDto;
    homepageClicks: AnalyticsComparisonDto;
  } | null;
};

export type AnalyticsTimeSeriesPointDto = {
  bucketStart: string;
  value: number;
  clicks?: number;
  impressions?: number;
};

export type AnalyticsTimeSeriesDto = {
  freshness: AnalyticsFreshnessDto;
  metric: string;
  composableAcrossBuckets: boolean;
  points: AnalyticsTimeSeriesPointDto[];
};

export type AnalyticsContentDisplayDto = {
  title: string;
  slug: string;
  publicationStatus: string;
  primaryCategoryId: string | null;
  primaryCategoryName: string | null;
  authors: { id: string; displayName: string }[];
};

export type AnalyticsContentItemDto = {
  contentItemId: string;
  articleViews: number;
  galleryOpens: number;
  galleryImageViews: number;
  videoImpressions: number;
  homepageImpressions: number;
  homepageClicks: number;
  homepageCtr: number | null;
  display: AnalyticsContentDisplayDto | null;
};

export type AnalyticsContentDto = {
  freshness: AnalyticsFreshnessDto;
  items: AnalyticsContentItemDto[];
};

export type AnalyticsSourcesDto = {
  freshness: AnalyticsFreshnessDto;
  audience: string;
  total: number;
  items: { sourceChannel: string; eventCount: number }[];
};

export type AnalyticsCategoriesDto = {
  freshness: AnalyticsFreshnessDto;
  attribution: string;
  items: { categoryId: string; name: string | null; articleViews: number; contentCount: number }[];
};

export type AnalyticsAuthorsDto = {
  freshness: AnalyticsFreshnessDto;
  attribution: string;
  items: {
    authorId: string;
    displayName: string | null;
    articleViews: number;
    contentCount: number;
  }[];
};

export type AnalyticsHomepageItemDto = {
  homepageVersionId: string | null;
  placement: string;
  position: number;
  contentItemId: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
  display: AnalyticsContentDisplayDto | null;
};

export type AnalyticsHomepageDto = {
  freshness: AnalyticsFreshnessDto;
  items: AnalyticsHomepageItemDto[];
};
