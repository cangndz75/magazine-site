import { CAPABILITY } from "@magazine/domain";
import { listStaffAccounts } from "@magazine/db/staff-administration";
import { StaffAdminWorkspace } from "@/components/staff-admin-workspace";
import { requireCapability } from "@/lib/auth/authorization";
import { staffAdminActorFromSession } from "@/lib/staff/actor";
import { parseStaffPageSearchParams } from "@/lib/staff/page-params";
import { serializeStaffAccountListItem } from "@/lib/staff/serialize";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Personel",
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.STAFF_MANAGE);
  const params = await searchParams;
  const filters = parseStaffPageSearchParams(params);

  const result = await listStaffAccounts({
    actor: staffAdminActorFromSession(session),
    search: filters.search,
    status: filters.status,
    role: filters.role,
    scopeMode: filters.scopeMode,
    limit: filters.limit,
    cursor: filters.cursor,
  });

  const items = result.items.map(serializeStaffAccountListItem);

  return (
    <StaffAdminWorkspace
      items={items}
      nextCursor={result.nextCursor}
      filters={filters}
    />
  );
}
