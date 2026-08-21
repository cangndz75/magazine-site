"use client";

import { useEffect, useState } from "react";
import type { AnalyticsPageFilters } from "@/lib/analytics/page-params";
import type {
  AnalyticsAuthorsDto,
  AnalyticsCategoriesDto,
  AnalyticsContentDto,
  AnalyticsHomepageDto,
  AnalyticsOverviewDto,
  AnalyticsSourcesDto,
  AnalyticsTimeSeriesDto,
} from "@/lib/analytics/types";
import { AnalyticsReportHeader } from "./analytics/analytics-report-header";
import { AnalyticsKpiStrip } from "./analytics/analytics-kpi-strip";
import { AnalyticsPrimaryChartSection } from "./analytics/analytics-primary-chart-section";
import { AnalyticsTopContent } from "./analytics/analytics-top-content";
import { AnalyticsContentPanel } from "./analytics/analytics-content-panel";
import { AnalyticsTrafficSources } from "./analytics/analytics-traffic-sources";
import { AnalyticsCategoryPerformance } from "./analytics/analytics-category-performance";
import { AnalyticsAuthorPerformance } from "./analytics/analytics-author-performance";
import { AnalyticsHomepagePerformance } from "./analytics/analytics-homepage-performance";
import { AnalyticsMediaEngagement } from "./analytics/analytics-media-engagement";
import { AnalyticsDataHealth } from "./analytics/analytics-data-health";

const LG_MEDIA_QUERY = "(min-width: 1024px)";

function useIsLgViewport() {
  const [isLg, setIsLg] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(LG_MEDIA_QUERY);
    const sync = () => setIsLg(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  return isLg;
}

type Props = {
  filters: AnalyticsPageFilters;
  rangeInvalid: boolean;
  overview: AnalyticsOverviewDto;
  timeseries: AnalyticsTimeSeriesDto;
  content: AnalyticsContentDto;
  sources: AnalyticsSourcesDto;
  categories: AnalyticsCategoriesDto;
  authors: AnalyticsAuthorsDto;
  homepage: AnalyticsHomepageDto;
};

export function AnalyticsWorkspace({
  filters,
  rangeInvalid,
  overview,
  timeseries,
  content,
  sources,
  categories,
  authors,
  homepage,
}: Props) {
  const isLgViewport = useIsLgViewport();
  const [selectedContentItemId, setSelectedContentItemId] = useState<string | null>(null);
  const selectedItem =
    content.items.find((item) => item.contentItemId === selectedContentItemId) ?? null;

  return (
    <div className="mx-auto max-w-[100rem] px-4 py-6">
      <AnalyticsReportHeader
        filters={filters}
        freshness={overview.freshness}
        rangeInvalid={rangeInvalid}
      />

      <AnalyticsKpiStrip overview={overview} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <AnalyticsPrimaryChartSection filters={filters} timeseries={timeseries} />

          <AnalyticsTopContent
            filters={filters}
            content={content.items}
            selectedContentItemId={selectedContentItemId}
            onSelect={(id) =>
              setSelectedContentItemId((current) => (current === id ? null : id))
            }
          />

          <AnalyticsTrafficSources sources={sources} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <AnalyticsCategoryPerformance categories={categories} />
            <AnalyticsAuthorPerformance authors={authors} />
          </div>

          <AnalyticsHomepagePerformance homepage={homepage} content={content.items} />

          <AnalyticsMediaEngagement overview={overview} />

          {/* Data health also renders inline for narrow viewports where the rail is hidden. */}
          <div className="lg:hidden">
            <AnalyticsDataHealth freshness={overview.freshness} />
          </div>
        </div>

        <aside className="hidden min-w-0 space-y-6 lg:block">
          <div className="sticky top-16 space-y-6">
            <AnalyticsDataHealth freshness={overview.freshness} />
            <AnalyticsContentPanel
              variant="rail"
              item={selectedItem}
              onClose={() => setSelectedContentItemId(null)}
            />
          </div>
        </aside>
      </div>

      {!isLgViewport ? (
        <div className="lg:hidden">
          <AnalyticsContentPanel
            variant="drawer"
            item={selectedItem}
            onClose={() => setSelectedContentItemId(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
