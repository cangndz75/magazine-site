import Link from "next/link";
import type { PublicArticleAuthor, PublicArticleCategory } from "@magazine/db/public";
import { formatPublicationDate } from "@/lib/format-publication-date";

type PublicPhotoGalleryHeaderProps = {
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  publishedAt: Date;
  publicDateModified: Date | null;
  categories: PublicArticleCategory[];
  authors: PublicArticleAuthor[];
  imageCount: number;
};

function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "M";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 1).toLocaleUpperCase("tr-TR");
  }
  return `${parts[0]!.slice(0, 1)}${parts[parts.length - 1]!.slice(0, 1)}`.toLocaleUpperCase(
    "tr-TR",
  );
}

export function PublicPhotoGalleryHeader({
  title,
  subtitle,
  excerpt,
  publishedAt,
  publicDateModified,
  categories,
  authors,
  imageCount,
}: PublicPhotoGalleryHeaderProps) {
  const primaryCategory = categories.find((category) => category.isPrimary);
  const dek = subtitle ?? excerpt ?? null;
  const showUpdated =
    publicDateModified !== null &&
    publicDateModified.getTime() !== publishedAt.getTime();

  return (
    <header className="photo-gallery-header">
      <nav className="photo-gallery-header__crumb" aria-label="Konum">
        <Link href="/#homepage-photo-galleries-heading">Foto Galeri</Link>
        {primaryCategory ? (
          <>
            <span className="photo-gallery-header__crumb-sep" aria-hidden="true">·</span>
            <span>{primaryCategory.name}</span>
          </>
        ) : null}
      </nav>
      <p className="photo-gallery-header__identity">
        Foto Galeri · {imageCount} Fotoğraf
      </p>
      <h1 className="photo-gallery-header__title">{title}</h1>
      {dek ? <p className="photo-gallery-header__deck">{dek}</p> : null}
      <div className="photo-gallery-header__byline">
        {authors.map((author) => (
          <span key={author.slug} className="photo-gallery-header__author">
            <span className="photo-gallery-header__avatar" aria-hidden="true">
              {authorInitials(author.displayName)}
            </span>
            <span>
              <span className="photo-gallery-header__author-name">{author.displayName}</span>
              <span className="photo-gallery-header__author-role">
                {author.role === "AUTHOR" ? "Yazar" : "Katkı"}
              </span>
            </span>
          </span>
        ))}
        <p className="photo-gallery-header__meta">
          <time dateTime={publishedAt.toISOString()}>
            {formatPublicationDate(publishedAt)}
          </time>
          <span className="photo-gallery-header__meta-sep" aria-hidden="true">·</span>
          <span>{imageCount} fotoğraf</span>
        </p>
      </div>
      {showUpdated ? (
        <p className="photo-gallery-header__updated">
          Güncellendi{" "}
          <time dateTime={publicDateModified!.toISOString()}>
            {formatPublicationDate(publicDateModified!)}
          </time>
        </p>
      ) : null}
    </header>
  );
}
