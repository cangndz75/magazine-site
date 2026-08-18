import type { PublicArticleAuthor, PublicArticleCategory } from "@magazine/db/public";
import { formatPublicationDate } from "@/lib/format-publication-date";

type ArticleHeaderProps = {
  title: string;
  subtitle: string | null;
  publishedAt: Date;
  publicDateModified: Date | null;
  categories: PublicArticleCategory[];
  authors: PublicArticleAuthor[];
};

export function ArticleHeader({
  title,
  subtitle,
  publishedAt,
  publicDateModified,
  categories,
  authors,
}: ArticleHeaderProps) {
  const primaryCategory = categories.find((category) => category.isPrimary);
  const authorNames = authors.map((author) => author.displayName).join(", ");
  const showUpdated =
    publicDateModified !== null &&
    publicDateModified.getTime() !== publishedAt.getTime();

  return (
    <header className="article-header">
      {primaryCategory ? (
        <p className="article-header__kicker">{primaryCategory.name}</p>
      ) : null}
      <h1 className="article-header__title">{title}</h1>
      {subtitle ? <p className="article-header__deck">{subtitle}</p> : null}
      <p className="article-header__meta">
        {authorNames ? <span>{authorNames}</span> : null}
        {authorNames ? <span className="article-header__meta-sep"> · </span> : null}
        <time dateTime={publishedAt.toISOString()}>
          {formatPublicationDate(publishedAt)}
        </time>
      </p>
      {showUpdated ? (
        <p className="article-header__updated">
          Güncellendi{" "}
          <time dateTime={publicDateModified!.toISOString()}>
            {formatPublicationDate(publicDateModified!)}
          </time>
        </p>
      ) : null}
    </header>
  );
}
