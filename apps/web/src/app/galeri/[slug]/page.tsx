import type { Metadata } from "next";
import { REDIRECT_RESOLUTION } from "@magazine/domain";
import { resolvePublicRedirect } from "@magazine/db/redirects";
import { notFound, permanentRedirect } from "next/navigation";
import { AnalyticsArticleView } from "@/components/analytics/analytics-page-view";
import { ArticleHero } from "@/components/article-hero";
import { ArticleShare } from "@/components/article-share";
import { PublicArticleLegalNotices } from "@/components/public-article-legal-notices";
import { PublicPhotoGalleryHeader } from "@/components/public-photo-gallery-header";
import { PublicPhotoGalleryRelated } from "@/components/public-photo-gallery-related";
import { PublicPhotoGalleryStory } from "@/components/public-photo-gallery-story";
import { env } from "@/lib/env";
import { getPublicHomepage } from "@/lib/public-homepage";
import { getPublicPhotoGalleryBySlug } from "@/lib/public-gallery";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gallery = await getPublicPhotoGalleryBySlug(slug);
  if (!gallery) {
    const manual = await resolvePublicRedirect(`/galeri/${slug}`);
    if (manual.kind === REDIRECT_RESOLUTION.REDIRECT) {
      permanentRedirect(manual.targetPath);
    }
    return {};
  }
  const canonical = new URL(`/galeri/${gallery.slug}`, env.SITE_URL).toString();
  return {
    title: gallery.seoTitle ?? gallery.title,
    description: gallery.seoDescription ?? gallery.excerpt ?? undefined,
    robots: gallery.robots ?? undefined,
    alternates: { canonical },
  };
}

export default async function PublicPhotoGalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const gallery = await getPublicPhotoGalleryBySlug(slug);
  if (!gallery) {
    const manual = await resolvePublicRedirect(`/galeri/${slug}`);
    if (manual.kind === REDIRECT_RESOLUTION.REDIRECT) {
      permanentRedirect(manual.targetPath);
    }
    notFound();
  }

  const homepage = await getPublicHomepage();
  const publicUrl = new URL(`/galeri/${gallery.slug}`, env.SITE_URL).toString();
  const imageCount = gallery.images.length;

  return (
    <div className="public-photo-gallery-page">
      <AnalyticsArticleView
        contentItemId={gallery.id}
        publicSlug={gallery.slug}
        analyticsContext={gallery.analyticsContext ?? ""}
      />

      <div className="public-photo-gallery-page__intro">
        <PublicPhotoGalleryHeader
          title={gallery.title}
          subtitle={gallery.subtitle}
          excerpt={gallery.excerpt}
          publishedAt={gallery.publishedAt}
          publicDateModified={gallery.publicDateModified}
          categories={gallery.categories}
          authors={gallery.authors}
          imageCount={imageCount}
        />
        <ArticleShare title={gallery.title} url={publicUrl} />
        <PublicArticleLegalNotices notices={gallery.legalNotices} />
      </div>

      <div className="public-photo-gallery-page__hero">
        <ArticleHero hero={gallery.cover} title={gallery.title} />
      </div>

      <PublicPhotoGalleryStory
        key={gallery.images.map((item) => item.mediaId).join(":")}
        items={gallery.images}
        contentItemId={gallery.id}
        analyticsContext={gallery.analyticsContext ?? ""}
      />

      <PublicPhotoGalleryRelated
        galleries={homepage.galleries}
        currentSlug={gallery.slug}
      />
    </div>
  );
}
