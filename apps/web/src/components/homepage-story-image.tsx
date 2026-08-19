import Image from "next/image";
import type { PublicArticleHeroMedia } from "@magazine/db/public";
import { env } from "@/lib/env";

type HomepageStoryImageProps = {
  hero: PublicArticleHeroMedia;
  title: string;
  className?: string;
  sizes: string;
  priority?: boolean;
};

export function HomepageStoryImage({
  hero,
  title,
  className,
  sizes,
  priority = false,
}: HomepageStoryImageProps) {
  const width = hero.width ?? 1200;
  const height = hero.height ?? 800;
  const useUnoptimizedImage = env.APP_ENV === "development";

  return (
    <Image
      src={hero.url}
      alt={hero.altText ?? title}
      width={width}
      height={height}
      sizes={sizes}
      className={className}
      priority={priority}
      unoptimized={useUnoptimizedImage}
    />
  );
}
