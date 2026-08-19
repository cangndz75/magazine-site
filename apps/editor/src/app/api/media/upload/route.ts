import { uploadEditorImage } from "@magazine/db/editor";
import { CAPABILITY } from "@magazine/domain";
import { withEditorMutation } from "@/lib/content/api-auth";
import { editorOk } from "@/lib/content/http";
import { env } from "@/lib/env";
import { createMediaObjectStoreFromEnv } from "@/lib/media/object-store";
import { serializeMediaLibraryItem } from "@/lib/media/serialize";
import { readMediaUploadFile } from "@/lib/media/upload-request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  return withEditorMutation(request, CAPABILITY.CONTENT_EDIT, async (session, mutationRequest) => {
    const file = await readMediaUploadFile(mutationRequest);
    const item = await uploadEditorImage({
      roles: session.roles,
      bytes: file.bytes,
      originalFilename: file.originalFilename,
      storage: createMediaObjectStoreFromEnv(env),
      mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
    });
    return editorOk(serializeMediaLibraryItem(item), 201);
  });
}
