import {
  loadPublicSitemapIndexLocs,
} from "@/lib/seo/public-sitemap";
import {
  SITEMAP_XML_HEADERS,
  serializeSitemapIndex,
} from "@/lib/seo/sitemap-xml";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const locs = await loadPublicSitemapIndexLocs();
  return new Response(serializeSitemapIndex(locs), {
    status: 200,
    headers: SITEMAP_XML_HEADERS,
  });
}