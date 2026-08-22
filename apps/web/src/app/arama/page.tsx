import type { Metadata } from "next";
import { PublicSearchWorkspace } from "@/components/public-search-workspace";
import { getPublicSearchResults } from "@/lib/public-search";
import {
  isPublicSearchQueryReady,
  parsePublicSearchPageParams,
} from "@/lib/search/page-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Arama",
  robots: {
    index: false,
    follow: true,
  },
};

export default async function PublicSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parsePublicSearchPageParams(await searchParams);
  const results = isPublicSearchQueryReady(params.q)
    ? await getPublicSearchResults({
        query: params.q,
        filter: params.filter,
        cursor: params.cursor,
      })
    : null;

  return (
    <div className="public-search-page">
      <PublicSearchWorkspace params={params} results={results} />
    </div>
  );
}
