import { CAPABILITY, isUuid, seoInspectionLeaksSensitiveMaterial } from "@magazine/domain";
import { getSeoInspectionDetail } from "@magazine/db/seo";
import { withEditorRead } from "@/lib/content/api-auth";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { EDITOR_API_ERROR, EditorHttpError, editorOk } from "@/lib/content/http";
import { env } from "@/lib/env";
import { serializeSeoInspectionDetail } from "@/lib/seo/serialize";
import { configuredPublicPublisher } from "@/lib/seo/publisher";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ contentItemId: string }> },
) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async (session) => {
    const { contentItemId } = await context.params;
    if (!isUuid(contentItemId)) {
      throw new EditorHttpError(
        400,
        EDITOR_API_ERROR.INVALID_REQUEST,
        "The request is invalid.",
      );
    }

    const detail = await getSeoInspectionDetail({
      scope: editorScopeFromSession(session),
      contentItemId,
      trustedSiteUrl: env.SITE_URL,
      editorOrigin: env.EDITOR_URL,
      mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      publisher: configuredPublicPublisher(),
    });
    const data = serializeSeoInspectionDetail(detail);
    if (seoInspectionLeaksSensitiveMaterial(data)) {
      throw new Error("SEO inspector response leaked sensitive material.");
    }
    return editorOk(data);
  });
}
