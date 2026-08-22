import Image from "next/image";
import { env } from "@/lib/env";

type HomepagePreviewStillProps = {
  src: string;
  alt: string;
  className?: string;
  sizes: string;
  objectPosition?: string;
};

export function HomepagePreviewStill({
  src,
  alt,
  className,
  sizes,
  objectPosition,
}: HomepagePreviewStillProps) {
  const useUnoptimizedImage = env.APP_ENV === "development";

  return (
    <Image
      src={src}
      alt={alt}
      width={1600}
      height={1067}
      sizes={sizes}
      className={className}
      unoptimized={useUnoptimizedImage}
      style={objectPosition ? { objectPosition } : undefined}
    />
  );
}
