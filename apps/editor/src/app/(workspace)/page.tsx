import { CAPABILITY } from "@magazine/domain";
import { listEditorContent } from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import { queryScopeFromSession } from "@/lib/content/authorize";
import {
  ContentWorkspace,
  type ContentListItem,
} from "@/components/content-workspace";
import { parsePageSearchParams } from "@/lib/content/page-params";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "İçerikler",
};

export default async function ContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.CONTENT_READ);
  const params = await searchParams;
  const filters = parsePageSearchParams(params);

  const result = await listEditorContent(
    queryScopeFromSession(session),
    {
      limit: filters.limit,
      cursor: filters.cursor,
      search: filters.search,
      publicationStatus: filters.publicationStatus,
      workflowStatus: filters.workflowStatus,
      categoryId: filters.categoryId,
      scheduledOnly: filters.scheduledOnly,
    },
  );

  const items: ContentListItem[] = result.items.map((row) => ({
    ...row,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publicDateModified: row.publicDateModified?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  }));

  return (
    <ContentWorkspace
      items={items}
      nextCursor={result.nextCursor}
      filters={filters}
      sessionDisplayName={session.displayName}
    />
  );
}
