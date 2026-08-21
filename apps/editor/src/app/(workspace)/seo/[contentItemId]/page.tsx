import { notFound } from "next/navigation";
import {
  CAPABILITY,
  SEO_INSPECTION_ERROR,
  SeoInspectionError,
  isUuid,
} from "@magazine/domain";
import { getSeoInspectionDetail } from "@magazine/db/seo";
import { requireCapability } from "@/lib/auth/authorization";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { env } from "@/lib/env";
import { serializeSeoInspectionDetail } from "@/lib/seo/serialize";
import { configuredPublicPublisher } from "@/lib/seo/publisher";
import { SeoInspector } from "@/components/seo-inspector";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SEO incelemesi",
};

export default async function SeoInspectorPage({
  params,
  searchParams,
}: {
  params: Promise<{ contentItemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.CONTENT_READ);
  const { contentItemId } = await params;
  if (!isUuid(contentItemId)) {
    notFound();
  }

  const resolvedSearch = await searchParams;
  const returnToRaw =
    typeof resolvedSearch.returnTo === "string" ? resolvedSearch.returnTo : "/seo";
  const returnHref = returnToRaw.startsWith("/seo") ? returnToRaw : "/seo";

  let detail;
  try {
    detail = await getSeoInspectionDetail({
      scope: editorScopeFromSession(session),
      contentItemId,
      trustedSiteUrl: env.SITE_URL,
      editorOrigin: env.EDITOR_URL,
      mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      publisher: configuredPublicPublisher(),
    });
  } catch (error) {
    if (
      error instanceof SeoInspectionError &&
      error.code === SEO_INSPECTION_ERROR.CONTENT_NOT_FOUND
    ) {
      notFound();
    }
    throw error;
  }

  return (
    <SeoInspector
      detail={serializeSeoInspectionDetail(detail)}
      returnHref={returnHref}
    />
  );
}
