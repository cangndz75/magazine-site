import { encodeEditorListCursor } from "@magazine/domain";
import { listEntities } from "@magazine/db/entities";
import { EntityAdminWorkspace } from "@/components/entity-admin-workspace";
import { requireEntityWrite } from "@/lib/entity/authorization";
import { parseEntityPageSearchParams } from "@/lib/entity/page-params";
import { serializeEntityListItem } from "@/lib/entity/serialize";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Varlıklar",
};

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireEntityWrite();
  const params = await searchParams;
  const filters = parseEntityPageSearchParams(params);

  const result = await listEntities({
    actorRoles: session.roles,
    q: filters.search ?? undefined,
    kind: filters.kind,
    status: filters.status,
    missingPortrait: filters.missingPortrait,
    limit: filters.limit,
    cursor: filters.cursor ? encodeEditorListCursor(filters.cursor) : undefined,
  });

  return (
    <EntityAdminWorkspace
      items={result.items.map(serializeEntityListItem)}
      nextCursor={result.nextCursor}
      filters={filters}
    />
  );
}
