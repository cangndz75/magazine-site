import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { JsonLdScript } from "@/components/json-ld-script";
import { PublicEntityBiography } from "@/components/public-entity-biography";
import { PublicEntityProfileHeader } from "@/components/public-entity-profile-header";
import { PublicEntityRelatedStory } from "@/components/public-entity-related-story";
import { PublicEntityTimeline } from "@/components/public-entity-timeline";
import { SectionHeader } from "@/components/section-header";
import { env } from "@/lib/env";
import { getPublicEntityPageBySlug } from "@/lib/public-entity";
import { buildPublicEntityPageSeo } from "@/lib/seo/entity-seo";
import { publicEntityCanonicalUrl } from "@/lib/seo/public-site-url";

function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw.trim() === "") {
    return 1;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function entityPageHref(slug: string, page: number): string {
  if (page <= 1) {
    return `/kimdir/${slug}`;
  }
  return `/kimdir/${slug}?page=${page}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const pageNumber = parsePageParam(pageParam);
  const result = await getPublicEntityPageBySlug(slug, pageNumber);

  if (result?.status === "redirect") {
    permanentRedirect(publicEntityCanonicalUrl(env.SITE_URL, result.slug));
  }

  return buildPublicEntityPageSeo(result, env.SITE_URL).metadata;
}

export default async function PublicEntityProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const pageNumber = parsePageParam(pageParam);
  const result = await getPublicEntityPageBySlug(slug, pageNumber);

  if (result?.status === "redirect") {
    permanentRedirect(publicEntityCanonicalUrl(env.SITE_URL, result.slug));
  }
  if (!result || result.status !== "found") {
    notFound();
  }

  const totalPages = Math.max(1, Math.ceil(result.totalStories / result.pageSize));
  if (pageNumber > totalPages) {
    notFound();
  }

  const { entity, stories } = result;
  const { jsonLdScript } = buildPublicEntityPageSeo(result, env.SITE_URL);
  const hasStories = result.totalStories > 0;

  return (
    <div className="public-entity-page">
      {jsonLdScript ? <JsonLdScript json={jsonLdScript} /> : null}

      <div className="public-entity-page__header">
        <PublicEntityProfileHeader entity={entity} />
      </div>

      {entity.biography ? (
        <div className="public-entity-page__biography">
          <PublicEntityBiography biography={entity.biography} />
        </div>
      ) : null}

      <section className="public-entity-page__stories" aria-labelledby="entity-stories-heading">
        <SectionHeader title="İlgili haberler" id="entity-stories-heading" variant="editorial" />

        {!hasStories ? (
          <p className="public-entity-page__empty">
            Bu varlıkla ilgili yayımlanmış haber bulunmuyor.
          </p>
        ) : (
          <>
            <div className="public-entity-page__cards">
              {stories.map((story) => (
                <PublicEntityRelatedStory
                  key={`${story.contentItemId}:${story.publishedVersionId}`}
                  story={story}
                />
              ))}
            </div>

            <div className="public-entity-page__timeline">
              <PublicEntityTimeline stories={stories} />
            </div>

            {totalPages > 1 ? (
              <nav
                className="public-entity-page__pagination"
                aria-label="İlgili haber sayfaları"
              >
                {result.page > 1 ? (
                  <Link
                    href={entityPageHref(entity.slug, result.page - 1)}
                    className="public-entity-page__pagination-link public-entity-page__pagination-link--prev"
                    rel="prev"
                  >
                    Önceki
                  </Link>
                ) : (
                  <span className="public-entity-page__pagination-spacer" aria-hidden="true" />
                )}
                <span className="public-entity-page__pagination-status">
                  Sayfa {result.page} / {totalPages}
                </span>
                {result.page < totalPages ? (
                  <Link
                    href={entityPageHref(entity.slug, result.page + 1)}
                    className="public-entity-page__pagination-link public-entity-page__pagination-link--next"
                    rel="next"
                  >
                    Sonraki
                  </Link>
                ) : (
                  <span className="public-entity-page__pagination-spacer" aria-hidden="true" />
                )}
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
