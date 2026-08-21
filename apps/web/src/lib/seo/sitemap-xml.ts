import type { PublicSitemapEntry } from "@magazine/domain";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function lastmod(value: Date | string | null | undefined): string {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `\n<lastmod>${escapeXml(date.toISOString())}</lastmod>`;
}

export function serializeSitemapIndex(locs: readonly string[]): string {
  const body = locs
    .map((loc) => `<sitemap>\n<loc>${escapeXml(loc)}</loc>\n</sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

export function serializeSitemapUrlset(
  entries: readonly PublicSitemapEntry[],
): string {
  const body = entries
    .map(
      (entry) =>
        `<url>\n<loc>${escapeXml(entry.loc)}</loc>${lastmod(entry.lastModified)}\n</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export const SITEMAP_XML_HEADERS = {
  "content-type": "application/xml; charset=utf-8",
  "cache-control": "no-store",
} as const;
