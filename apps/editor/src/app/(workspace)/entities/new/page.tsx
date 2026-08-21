import { EntityDetailWorkspace } from "@/components/entity-detail-workspace";
import { requireEntityWrite } from "@/lib/entity/authorization";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Yeni Varlık",
};

export default async function NewEntityPage() {
  await requireEntityWrite();
  return <EntityDetailWorkspace mode="create" />;
}
