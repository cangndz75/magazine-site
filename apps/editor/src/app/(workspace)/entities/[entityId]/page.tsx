import { notFound } from "next/navigation";
import { EntityError, ENTITY_ERROR } from "@magazine/domain";
import { getEntityById } from "@magazine/db/entities";
import { EntityDetailWorkspace } from "@/components/entity-detail-workspace";
import { requireEntityWrite } from "@/lib/entity/authorization";
import { parseEntityId } from "@/lib/entity/payload";
import { serializeEntityDetail } from "@/lib/entity/serialize";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  return { title: "Varlık" };
}

import type { StaffRole } from "@magazine/domain";

async function loadEntityDetail(entityId: string, roles: readonly StaffRole[]) {
  try {
    const entity = await getEntityById({
      actorRoles: roles,
      entityId,
    });
    return serializeEntityDetail(entity);
  } catch (error) {
    if (error instanceof EntityError && error.code === ENTITY_ERROR.ENTITY_NOT_FOUND) {
      notFound();
    }
    throw error;
  }
}

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const session = await requireEntityWrite();
  const { entityId: rawId } = await params;

  let entityId: string;
  try {
    entityId = parseEntityId(rawId);
  } catch {
    notFound();
  }

  const initial = await loadEntityDetail(entityId, session.roles);
  return <EntityDetailWorkspace mode="edit" initial={initial} />;
}
