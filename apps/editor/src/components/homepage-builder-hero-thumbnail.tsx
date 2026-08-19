"use client";

import { useState } from "react";
import type { EditorSafeHeroThumbnail } from "@magazine/domain";
import {
  homepageBuilderHeroVisual,
  type HomepageBuilderHeroSize,
} from "@/lib/homepage/builder-hero-visual";

const FRAME_CLASS: Record<HomepageBuilderHeroSize, string> = {
  pool: "h-12 w-[4.5rem] shrink-0 overflow-hidden rounded bg-zinc-100",
  lead: "mb-3 aspect-[16/9] w-full overflow-hidden rounded bg-zinc-100",
  support: "h-16 w-[6.5rem] shrink-0 overflow-hidden rounded bg-zinc-100 sm:h-[4.5rem] sm:w-[7.25rem]",
  featured: "mb-2 aspect-[16/9] w-full overflow-hidden rounded bg-zinc-100",
};

type Props = {
  hero: EditorSafeHeroThumbnail | null;
  size: HomepageBuilderHeroSize;
  loading?: "lazy" | "eager";
};

export function HomepageBuilderHeroThumbnail({
  hero,
  size,
  loading = "lazy",
}: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const visual = homepageBuilderHeroVisual(hero, imageFailed);

  return (
    <div className={FRAME_CLASS[size]} aria-hidden="true">
      {visual === "image" && hero ? (
        // Preview URLs are resolved server-side from MEDIA_PUBLIC_BASE_URL.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hero.url}
          alt=""
          width={hero.width ?? undefined}
          height={hero.height ?? undefined}
          loading={loading}
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="h-full w-full bg-zinc-100" />
      )}
    </div>
  );
}
