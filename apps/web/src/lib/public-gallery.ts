import "server-only";

import { cache } from "react";
import { getPublicPhotoGalleryBySlug as loadPublicPhotoGalleryBySlug } from "@magazine/db/public";
import { env } from "./env";

export const getPublicPhotoGalleryBySlug = cache((slug: string) =>
  loadPublicPhotoGalleryBySlug(slug, {
    mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
    analyticsContextSigningKey: env.ANALYTICS_CONTEXT_SIGNING_KEY,
  }),
);
