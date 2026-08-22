import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalyticsArticleView } from "@/components/analytics/analytics-page-view";
import { ArticleHeader } from "@/components/article-header";
import { ArticleHero } from "@/components/article-hero";
import { ArticleShare } from "@/components/article-share";
import { PublicArticleGallery } from "@/components/public-article-gallery";
import { PublicArticleLegalNotices } from "@/components/public-article-legal-notices";
import { env } from "@/lib/env";
import { getPublicPhotoGalleryBySlug } from "@/lib/public-gallery";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gallery = await getPublicPhotoGalleryBySlug(slug);
  if (!gallery) {
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
    notFound();
  }

  const publicUrl = new URL(`/galeri/${gallery.slug}`, env.SITE_URL).toString();

  return (
    <div className="public-article-page">
      <AnalyticsArticleView
        contentItemId={gallery.id}
        publicSlug={gallery.slug}
        analyticsContext={gallery.analyticsContext ?? ""}
      />
      <div className="public-article-page__text">
        <ArticleHeader
          title={gallery.title}
          subtitle={gallery.subtitle}
          publishedAt={gallery.publishedAt}
          publicDateModified={gallery.publicDateModified}
          categories={gallery.categories}
          authors={gallery.authors}
        />
        <ArticleShare title={gallery.title} url={publicUrl} />
        <PublicArticleLegalNotices notices={gallery.legalNotices} />
      </div>

      <div className="public-article-page__hero">
        <ArticleHero hero={gallery.cover} title={gallery.title} />
      </div>

      <div className="public-article-page__gallery">
        <PublicArticleGallery
          key={gallery.images.map((item) => item.mediaId).join(":")}
          contentItemId={gallery.id}
          analyticsContext={gallery.analyticsContext ?? ""}
          items={gallery.images}
        />
      </div>
    </div>
  );
}
