import { CAPABILITY } from "@magazine/domain";
import {
  getEditorCategorySummary,
  lookupEditorCategories,
} from "@magazine/db/editor";
import { listSeoInspections, summarizeSeoInspections } from "@magazine/db/seo";
import { requireCapability } from "@/lib/auth/authorization";
import { editorScopeFromSession, queryScopeFromSession } from "@/lib/content/authorize";
import { mergeSelectedOption } from "@/lib/content/filter-query";
import { env } from "@/lib/env";
import { parseSeoPageSearchParams } from "@/lib/seo/page-params";
import { serializeSeoInspectionListItem } from "@/lib/seo/serialize";
import { configuredPublicPublisher } from "@/lib/seo/publisher";
import { SeoWorkspace } from "@/components/seo-workspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SEO",
};

export default async function SeoCommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.CONTENT_READ);
  const params = await searchParams;
  const filters = parseSeoPageSearchParams(params);
  const scope = editorScopeFromSession(session);
  const queryScope = queryScopeFromSession(session);

  const [result, summary, categoryOptions, selectedCategory] = await Promise.all([
    listSeoInspections({
      scope,
      filters: {
        limit: filters.limit,
        cursor: filters.cursor,
        search: filters.search,
        publicationStatus: filters.publicationStatus,
        notPublished: filters.notPublished,
        categoryId: filters.categoryId,
        indexable: filters.indexable,
        missingSeoTitle: filters.missingSeoTitle,
        missingMetaDescription: filters.missingMetaDescription,
        missingHero: filters.missingHero,
        missingHeroAlt: filters.missingHeroAlt,
        findingFilter: filters.findingFilter,
        legalWithdrawal: filters.legalWithdrawal,
        discoverReadiness: filters.discoverReadiness,
      },
      trustedSiteUrl: env.SITE_URL,
      editorOrigin: env.EDITOR_URL,
      mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      publisher: configuredPublicPublisher(),
    }),
    summarizeSeoInspections({
      scope,
      categoryId: filters.categoryId,
    }),
    lookupEditorCategories({
      scopedCategoryIds: queryScope.scopedCategoryIds,
    }),
    filters.categoryId
      ? getEditorCategorySummary(filters.categoryId, queryScope.scopedCategoryIds)
      : Promise.resolve(null),
  ]);

  return (
    <SeoWorkspace
      items={result.items.map(serializeSeoInspectionListItem)}
      nextCursor={result.nextCursor}
      filters={filters}
      summary={summary}
      categoryOptions={mergeSelectedOption(selectedCategory, categoryOptions)}
      selectedCategory={selectedCategory}
    />
  );
}
