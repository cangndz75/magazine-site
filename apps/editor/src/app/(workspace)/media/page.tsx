import { CAPABILITY, hasCapability } from "@magazine/domain";
import { requireCapability } from "@/lib/auth/authorization";
import { MediaLibraryWorkspace } from "@/components/media-library-workspace";
import {
  DEFAULT_MEDIA_LIBRARY_QUERY,
  parseMediaLibraryPageSearchParams,
  parseMediaLibrarySelectedId,
} from "@/lib/media/params";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Medya Kütüphanesi",
};

export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.CONTENT_READ);
  const canEdit = hasCapability(session.roles, CAPABILITY.CONTENT_EDIT);
  const params = await searchParams;
  const parsed = parseMediaLibraryPageSearchParams(params);
  const filters =
    "error" in parsed ? DEFAULT_MEDIA_LIBRARY_QUERY : parsed;
  const selectedId = parseMediaLibrarySelectedId(params);

  return (
    <MediaLibraryWorkspace
      canEdit={canEdit}
      filters={filters}
      selectedId={selectedId}
    />
  );
}
