import { searchEditorContent } from "@magazine/db/search";
import { requireStaffSession } from "@/lib/auth/authorization";
import { queryScopeFromSession } from "@/lib/content/authorize";
import { EditorSearchWorkspace } from "@/components/editor-search-workspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Arama",
};

export default async function EditorSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireStaffSession();
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  const results =
    query.length >= 2
      ? await searchEditorContent({
          scope: queryScopeFromSession(session),
          query,
          limit: 25,
        })
      : { query, normalizedQuery: "", items: [] };

  return <EditorSearchWorkspace query={query} results={results} />;
}
