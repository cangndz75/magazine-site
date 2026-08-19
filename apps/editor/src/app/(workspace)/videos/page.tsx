import { CAPABILITY, hasCapability } from "@magazine/domain";
import { requireCapability } from "@/lib/auth/authorization";
import { VideoLibraryWorkspace } from "@/components/video-library-workspace";
import {
  DEFAULT_VIDEO_LIBRARY_QUERY,
  parseVideoLibraryPageSearchParams,
  parseVideoLibrarySelectedId,
} from "@/lib/video/params";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Videolar",
};

export default async function VideoLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.CONTENT_READ);
  const canEdit = hasCapability(session.roles, CAPABILITY.CONTENT_EDIT);
  const params = await searchParams;
  const parsed = parseVideoLibraryPageSearchParams(params);
  const filters =
    "error" in parsed ? DEFAULT_VIDEO_LIBRARY_QUERY : parsed;
  const selectedId = parseVideoLibrarySelectedId(params);

  return (
    <VideoLibraryWorkspace
      canEdit={canEdit}
      filters={filters}
      selectedId={selectedId}
    />
  );
}
