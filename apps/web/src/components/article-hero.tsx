import Image from "next/image";
import type { PublicArticleHeroMedia } from "@magazine/db/public";
import { env } from "@/lib/env";

type ArticleHeroProps = {
  hero: PublicArticleHeroMedia;
  title: string;
};

export function ArticleHero({ hero, title }: ArticleHeroProps) {
  const width = hero.width ?? 1200;
  const height = hero.height ?? 675;
  const useUnoptimizedImage = env.APP_ENV === "development";

  return (
    <figure className="article-hero">
      <div
        className="article-hero__frame"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <Image
          src={hero.url}
          alt={hero.altText ?? title}
          width={width}
          height={height}
          sizes="(min-width: 1280px) 840px, (min-width: 768px) 90vw, 100vw"
          className="article-hero__image"
          priority
          unoptimized={useUnoptimizedImage}
        />
      </div>
      {hero.credit ? (
        <figcaption className="article-hero__credit">{hero.credit}</figcaption>
      ) : null}
    </figure>
  );
}
