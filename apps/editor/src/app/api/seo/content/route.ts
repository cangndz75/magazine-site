import {
  CAPABILITY,
  seoInspectionLeaksSensitiveMaterial,
} from "@magazine/domain";
import {
  listSeoInspections,
  summarizeSeoInspections,
} from "@magazine/db/seo";
import { withEditorRead } from "@/lib/content/api-auth";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { editorOk } from "@/lib/content/http";
import { env } from "@/lib/env";
import { parseSeoInspectionSearchParams } from "@/lib/seo/list-params";
import { configuredPublicPublisher } from "@/lib/seo/publisher";
import {
  serializeSeoInspectionListItem,
  serializeSeoInspectionSummary,
} from "@/lib/seo/serialize";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withEditorRead(request, CAPABILITY.CONTENT_READ, async (session) => {
    const filters = parseSeoInspectionSearchParams(new URL(request.url));
    const scope = editorScopeFromSession(session);
    const [result, summary] = await Promise.all([
      listSeoInspections({
        scope,
        filters,
        trustedSiteUrl: env.SITE_URL,
        editorOrigin: env.EDITOR_URL,
        mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
        publisher: configuredPublicPublisher(),
      }),
      summarizeSeoInspections({
        scope,
        categoryId: filters.categoryId,
      }),
    ]);

    const data = {
      items: result.items.map(serializeSeoInspectionListItem),
      nextCursor: result.nextCursor,
      governance: result.governance,
      summary: serializeSeoInspectionSummary(summary),
    };

    if (seoInspectionLeaksSensitiveMaterial(data)) {
      throw new Error("SEO list response leaked sensitive material.");
    }

    return editorOk(data);
  });
}
