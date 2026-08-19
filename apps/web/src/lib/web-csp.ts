export const PUBLIC_VIDEO_FRAME_SRC_ORIGINS = [
  "https://www.youtube-nocookie.com",
  "https://player.vimeo.com",
] as const;

/**
 * Smallest public-web CSP addition for trusted article video embeds.
 * Only frame-src is set, so other resource types stay unrestricted by this header.
 */
export function publicWebContentSecurityPolicy(): string {
  return `frame-src 'self' ${PUBLIC_VIDEO_FRAME_SRC_ORIGINS.join(" ")}`;
}
