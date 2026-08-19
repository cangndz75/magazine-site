import path from "node:path";

const LOCAL_MEDIA_EXTENSION_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

export function sameOriginLocalMediaRewrite(input: {
  siteUrl: string;
  mediaPublicBaseUrl: string;
}): { source: string; destination: string } | null {
  let site: URL;
  let media: URL;
  try {
    site = new URL(input.siteUrl);
    media = new URL(input.mediaPublicBaseUrl);
  } catch {
    return null;
  }

  if (site.origin !== media.origin) {
    return null;
  }

  const mediaPath = media.pathname.replace(/\/$/, "") || "/media";
  if (!mediaPath.startsWith("/") || mediaPath.includes("..")) {
    return null;
  }

  return {
    source: `${mediaPath}/:path*`,
    destination: "/api/internal/local-media/:path*",
  };
}

export function localMediaContentType(filePath: string): string | null {
  const extension = path.extname(filePath).toLowerCase();
  return LOCAL_MEDIA_EXTENSION_MIME[extension] ?? null;
}

export function resolveLocalMediaFilePath(
  mediaRoot: string,
  keySegments: readonly string[],
): string | null {
  if (keySegments.length === 0) {
    return null;
  }
  for (const segment of keySegments) {
    if (
      segment.length === 0 ||
      segment === "." ||
      segment === ".." ||
      segment.includes("\\") ||
      segment.includes("\0") ||
      segment.includes("/")
    ) {
      return null;
    }
  }

  const resolvedRoot = path.resolve(mediaRoot);
  const absolute = path.resolve(resolvedRoot, ...keySegments);
  const relative = path.relative(resolvedRoot, absolute);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative.includes("\0")
  ) {
    return null;
  }
  if (localMediaContentType(absolute) === null) {
    return null;
  }
  return absolute;
}
