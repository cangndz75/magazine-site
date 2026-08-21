"use client";

import {
  parseSeoRobotsOverride,
  SEO_META_DESCRIPTION_POLICY,
  SEO_ROBOTS_DIRECTIVE,
  SEO_TITLE_POLICY,
  type PublicationStatus,
} from "@magazine/domain";
import type { ArticleEditorFields } from "@/lib/content/article-editor-state";
import type { ArticleEditorMedia } from "@/lib/content/article-relation-state";
import type { SeoSlugHistoryDto } from "@/lib/seo/serialize";
import { presentSeoSearchPreview } from "@/lib/seo/preview";
import {
  presentCanonicalRejection,
  presentIndexability,
} from "@/lib/seo/presentation";
import { SeoPreviewPanels } from "./seo-preview-panels";
import { SeoSlugHistory } from "./seo-slug-history";
import { ArticleSlugEditor } from "./article-slug-editor";

type Props = {
  fields: ArticleEditorFields;
  disabled: boolean;
  errors: Partial<Record<keyof ArticleEditorFields, string>>;
  onChange: <K extends keyof ArticleEditorFields>(
    key: K,
    value: ArticleEditorFields[K],
  ) => void;
  slug: string;
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  publishedAt: string | null;
  retractedAt: string | null;
  takedownAt: string | null;
  trustedSiteUrl: string;
  editorOrigin: string;
  hero: ArticleEditorMedia | null;
  slugHistory: SeoSlugHistoryDto[];
  isDraftRelativeToPublished: boolean;
  contentItemId: string;
  contentItemUpdatedAt: string;
  canEditSlug: boolean;
  onSlugUpdated: (next: { slug: string; updatedAt: string }) => void;
};

export function ArticleSeoSection({
  fields,
  disabled,
  errors,
  onChange,
  slug,
  publicationStatus,
  publishedVersionId,
  publishedAt,
  retractedAt,
  takedownAt,
  trustedSiteUrl,
  editorOrigin,
  hero,
  slugHistory,
  isDraftRelativeToPublished,
  contentItemId,
  contentItemUpdatedAt,
  canEditSlug,
  onSlugUpdated,
}: Props) {
  const preview = presentSeoSearchPreview({
    trustedSiteUrl,
    editorOrigin,
    slug,
    title: fields.title,
    seoTitle: fields.seoTitle,
    seoDescription: fields.seoDescription,
    excerpt: fields.excerpt,
    subtitle: fields.subtitle,
    storedCanonicalUrl: fields.canonicalUrl,
    storedRobots: fields.robots,
    publicationStatus,
    publishedVersionId,
    publishedAt,
    retractedAt,
    takedownAt,
  });
  const indexability = presentIndexability(preview.indexability);
  const withdrawn = retractedAt != null || takedownAt != null;
  const robotsValue =
    parseSeoRobotsOverride(fields.robots).directive === SEO_ROBOTS_DIRECTIVE.NOINDEX
      ? SEO_ROBOTS_DIRECTIVE.NOINDEX
      : SEO_ROBOTS_DIRECTIVE.DEFAULT;
  const seoTitleLength = (fields.seoTitle ?? "").trim().length;
  const seoDescriptionLength = (fields.seoDescription ?? "").trim().length;

  return (
    <section
      id="editor-section-seo"
      className="scroll-mt-24 border-t border-zinc-200 pt-6"
      aria-labelledby="article-seo-heading"
    >
      <h2 id="article-seo-heading" className="text-sm font-semibold text-zinc-900">
        SEO
      </h2>
      <p className="mt-1 text-sm text-zinc-600">
        Bu alanlar taslak sürüme aittir. Yayına alınmadan kamuya yansımaz.
      </p>
      {isDraftRelativeToPublished && (
        <p className="mt-2 text-sm text-zinc-600">
          Yayındaki kamuya açık metadata, bu taslak kaydedilse bile yayın
          sözleşmesiyle yetkili sürüm değişene kadar aynı kalır.
        </p>
      )}

      <div className="mt-4 rounded border border-zinc-200 bg-white px-3 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          İndekslenebilirlik
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-900">{indexability.label}</p>
        <p className="mt-1 text-sm text-zinc-600">{indexability.detail}</p>
        {!indexability.canEditorOverride && (
          <p className="mt-2 text-sm text-zinc-600">
            Sistem veya hukuki noindex kazanır. Aşağıdaki robots alanı bunu açamaz.
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="article-seo-title" className="mb-1 block text-sm font-medium text-zinc-700">
            SEO başlığı
          </label>
          <input
            id="article-seo-title"
            type="text"
            value={fields.seoTitle ?? ""}
            disabled={disabled}
            onChange={(event) => onChange("seoTitle", event.target.value)}
            className="h-9 w-full rounded border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-500"
          />
          <p className="mt-1 text-xs text-zinc-500">
            {seoTitleLength} karakter. Önerilen {SEO_TITLE_POLICY.MIN_CHARS}–
            {SEO_TITLE_POLICY.MAX_CHARS}. Yayın engeli değildir. Boşsa görünen başlık
            kullanılır; H1 değişmez.
          </p>
        </div>

        <div>
          <label htmlFor="article-canonical" className="mb-1 block text-sm font-medium text-zinc-700">
            Canonical URL
          </label>
          <input
            id="article-canonical"
            type="url"
            value={fields.canonicalUrl ?? ""}
            disabled={disabled}
            aria-invalid={Boolean(errors.canonicalUrl)}
            aria-describedby="article-canonical-help article-canonical-error"
            onChange={(event) => onChange("canonicalUrl", event.target.value)}
            className="h-9 w-full rounded border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-500"
          />
          <p id="article-canonical-help" className="mt-1 text-xs text-zinc-500">
            Boş bırakılırsa site adresi + slug kullanılır. Canonical yalnızca bu
            sitenin adresi olabilir.
            {preview.canonical.appliedOverride
              ? " Açık override uygulanıyor."
              : preview.canonical.rejection
                ? ` Geçersiz override yok sayılır: ${presentCanonicalRejection(preview.canonical.rejection)}`
                : " Varsayılan kanonik kullanılacak."}
          </p>
          {errors.canonicalUrl && (
            <p id="article-canonical-error" className="mt-1 text-sm text-red-600" role="alert">
              {errors.canonicalUrl}
            </p>
          )}
          <p className="mt-1 break-all text-xs text-zinc-500">
            Çözümlenen: {preview.url ?? "Üretilemedi"}
          </p>
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="article-seo-description"
            className="mb-1 block text-sm font-medium text-zinc-700"
          >
            SEO açıklaması
          </label>
          <textarea
            id="article-seo-description"
            rows={3}
            value={fields.seoDescription ?? ""}
            disabled={disabled}
            onChange={(event) => onChange("seoDescription", event.target.value)}
            className="w-full resize-y rounded border border-zinc-300 bg-white px-2.5 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-500"
          />
          <p className="mt-1 text-xs text-zinc-500">
            {seoDescriptionLength} karakter. Önerilen {SEO_META_DESCRIPTION_POLICY.MIN_CHARS}
            –{SEO_META_DESCRIPTION_POLICY.MAX_CHARS}. Yayın engeli değildir. Boşsa spot,
            sonra alt başlık kullanılır. Gövdeden üretilmez.
          </p>
        </div>

        <div>
          <label htmlFor="article-robots" className="mb-1 block text-sm font-medium text-zinc-700">
            Robots kısıtı
          </label>
          <select
            id="article-robots"
            value={robotsValue}
            disabled={disabled || withdrawn}
            onChange={(event) =>
              onChange(
                "robots",
                event.target.value === SEO_ROBOTS_DIRECTIVE.NOINDEX ? "noindex" : null,
              )
            }
            className="h-9 w-full rounded border border-zinc-300 bg-white px-2.5 text-sm text-zinc-900 outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-500"
          >
            <option value={SEO_ROBOTS_DIRECTIVE.DEFAULT}>Varsayılan</option>
            <option value={SEO_ROBOTS_DIRECTIVE.NOINDEX}>Noindex</option>
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Yalnızca kısıtlayıcı noindex desteklenir. Sistem veya hukuki noindex her
            zaman kazanır; index zorlanamaz.
          </p>
        </div>
      </div>

      <ArticleSlugEditor
        contentItemId={contentItemId}
        slug={slug}
        publicationStatus={publicationStatus}
        contentItemUpdatedAt={contentItemUpdatedAt}
        trustedSiteUrl={trustedSiteUrl}
        canEdit={canEditSlug && !withdrawn}
        onUpdated={onSlugUpdated}
      />

      <SeoPreviewPanels
        title={preview.title}
        visibleTitle={preview.visibleTitle}
        description={preview.description}
        url={preview.url}
        imageUrl={hero?.previewUrl ?? null}
      />

      <SeoSlugHistory entries={slugHistory} />
    </section>
  );
}
