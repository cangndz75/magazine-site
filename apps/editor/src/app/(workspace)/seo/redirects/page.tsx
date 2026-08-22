import { CAPABILITY } from "@magazine/domain";
import { listRedirectRules } from "@magazine/db/redirects";
import { RedirectManagerWorkspace } from "@/components/redirects/redirect-manager-workspace";
import { requireCapability } from "@/lib/auth/authorization";
import { redirectActorFromSession } from "@/lib/redirects/actor";
import { parseRedirectPageSearchParams } from "@/lib/redirects/page-params";
import { serializeRedirectRule } from "@/lib/redirects/serialize";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Yönlendirmeler",
};

export default async function SeoRedirectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.CONTENT_PUBLISH);
  const params = await searchParams;
  const filters = parseRedirectPageSearchParams(params);
  const result = await listRedirectRules({
    actor: redirectActorFromSession(session),
    search: filters.search,
    enabled: filters.enabled,
    cursor: filters.cursor,
    limit: filters.limit,
  });

  return (
    <main id="editor-content" className="px-4 py-5 sm:px-6 lg:px-8">
      <RedirectManagerWorkspace
        items={result.items.map(serializeRedirectRule)}
        nextCursor={result.nextCursor}
        filters={filters}
      />
    </main>
  );
}
