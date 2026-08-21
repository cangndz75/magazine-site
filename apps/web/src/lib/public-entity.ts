import "server-only";

import { cache } from "react";
import { ENTITY_RELATED_STORIES_DEFAULT_LIMIT } from "@magazine/domain";
import {
  getPublicEntityPageBySlug as loadPublicEntityPageBySlug,
  type PublicEntityPage,
} from "@magazine/db/entities";
import { env } from "./env";
import { cachedPublicEntityLoader } from "./public-entity-cache";

const publicEntityReadOptions = {
  mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
};

export const getPublicEntityPageBySlug = cache((slug: string, page = 1) => {
  const safePage = Math.max(1, Math.floor(page));
  const limit = ENTITY_RELATED_STORIES_DEFAULT_LIMIT;

  const loadPage = (canonicalSlug: string, pageNumber: number) => {
    const pageOffset = (Math.max(1, Math.floor(pageNumber)) - 1) * limit;
    return loadPublicEntityPageBySlug(canonicalSlug, {
      ...publicEntityReadOptions,
      limit,
      offset: pageOffset,
    });
  };

  return cachedPublicEntityLoader(slug, safePage, loadPage);
});

export type { PublicEntityPage };
