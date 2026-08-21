import { loadPublicSitemapShard } from "@/lib/seo/public-sitemap";
import {
  SITEMAP_XML_HEADERS,
  serializeSitemapUrlset,
} from "@/lib/seo/sitemap-xml";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const entries = await loadPublicSitemapShard(id);
  if (entries === null) {
    return new Response("Not Found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  }

  return new Response(serializeSitemapUrlset(entries), {
    status: 200,
    headers: SITEMAP_XML_HEADERS,
  });
}