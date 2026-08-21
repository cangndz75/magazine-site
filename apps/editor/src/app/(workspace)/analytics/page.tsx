import { CAPABILITY } from "@magazine/domain";
import {
  getAnalyticsAuthors,
  getAnalyticsCategories,
  getAnalyticsContentPerformance,
  getAnalyticsHomepageSlots,
  getAnalyticsOverview,
  getAnalyticsSources,
  getAnalyticsTimeSeries,
} from "@magazine/db/analytics";
import { requireCapability } from "@/lib/auth/authorization";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { parseAnalyticsPageSearchParams } from "@/lib/analytics/page-params";
import { assertSafeAnalyticsDto } from "@/lib/analytics/serialize";
import type {
  AnalyticsAuthorsDto,
  AnalyticsCategoriesDto,
  AnalyticsContentDto,
  AnalyticsHomepageDto,
  AnalyticsOverviewDto,
  AnalyticsSourcesDto,
  AnalyticsTimeSeriesDto,
} from "@/lib/analytics/types";
import { AnalyticsWorkspace } from "@/components/analytics-workspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytics",
};

/** JSON round-trips server data into a client-safe shape (Dates become ISO strings). */
function toClientJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.ANALYTICS_READ);
  const params = await searchParams;
  const { filters, period, rangeInvalid } = parseAnalyticsPageSearchParams(params);
  const scope = editorScopeFromSession(session);

  const [overview, timeseries, content, sources, categories, authors, homepage] =
    await Promise.all([
      getAnalyticsOverview({ period, scope, comparePrevious: filters.compare }),
      getAnalyticsTimeSeries({ period, metric: filters.metric, scope }),
      getAnalyticsContentPerformance({
        period,
        scope,
        sort: filters.sort,
        limit: 25,
        minImpressions: 20,
      }),
      getAnalyticsSources({ period, scope }),
      getAnalyticsCategories({ period, scope }),
      getAnalyticsAuthors({ period, scope }),
      getAnalyticsHomepageSlots({ period, scope }),
    ]);

  for (const dto of [overview, timeseries, content, sources, categories, authors, homepage]) {
    assertSafeAnalyticsDto(dto);
  }

  return (
    <AnalyticsWorkspace
      filters={filters}
      rangeInvalid={rangeInvalid}
      overview={toClientJson<AnalyticsOverviewDto>(overview)}
      timeseries={toClientJson<AnalyticsTimeSeriesDto>(timeseries)}
      content={toClientJson<AnalyticsContentDto>(content)}
      sources={toClientJson<AnalyticsSourcesDto>(sources)}
      categories={toClientJson<AnalyticsCategoriesDto>(categories)}
      authors={toClientJson<AnalyticsAuthorsDto>(authors)}
      homepage={toClientJson<AnalyticsHomepageDto>(homepage)}
    />
  );
}
