import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/json-ld-script";
import { PublicArticleBody } from "@/components/public-article-body";
import { env } from "@/lib/env";
import { getPublicArticleBySlug } from "@/lib/public-article";
import { buildPublicArticleSeo } from "@/lib/seo/article-seo";

function formatPublishedAt(value: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublicArticleBySlug(slug);
  return buildPublicArticleSeo(article, env.SITE_URL).metadata;
}

export default async function PublicArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublicArticleBySlug(slug);
  if (!article) {
    notFound();
  }

  const { jsonLdScript } = buildPublicArticleSeo(article, env.SITE_URL);
  const primaryCategory = article.categories.find((category) => category.isPrimary);
  const authorNames = article.authors.map((author) => author.displayName).join(", ");

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      {jsonLdScript ? <JsonLdScript json={jsonLdScript} /> : null}
      {primaryCategory && (
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">
          {primaryCategory.name}
        </p>
      )}
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
        {article.title}
      </h1>
      {article.subtitle && (
        <p className="mt-3 text-lg text-zinc-600">{article.subtitle}</p>
      )}
      <p className="mt-4 text-sm text-zinc-500">
        {formatPublishedAt(article.publishedAt)}
        {authorNames ? ` · ${authorNames}` : ""}
      </p>
      {article.hero ? (
        <figure className="mt-8">
          <Image
            src={article.hero.url}
            alt={article.hero.altText ?? article.title}
            width={article.hero.width ?? 1200}
            height={article.hero.height ?? 675}
            sizes="(min-width: 768px) 768px, 100vw"
            className="aspect-[16/9] w-full object-cover"
            priority
          />
          {article.hero.credit ? (
            <figcaption className="mt-2 text-xs text-zinc-500">
              {article.hero.credit}
            </figcaption>
          ) : null}
        </figure>
      ) : null}
      <article className="mt-8">
        <PublicArticleBody body={article.body} />
      </article>
    </main>
  );
}
