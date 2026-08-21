export function resolvePublicMediaUrl(
  mediaPublicBaseUrl: string | undefined,
  storageKey: string,
): string | null {
  const trimmedBase = mediaPublicBaseUrl?.trim();
  const trimmedKey = storageKey.trim();
  if (!trimmedBase || !trimmedKey) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmedBase);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  const basePath = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  const publicPath = trimmedKey
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  if (!publicPath) {
    return null;
  }

  url.pathname = `${basePath}${publicPath}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}
