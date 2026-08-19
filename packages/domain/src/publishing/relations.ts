import { MEDIA_ROLE, type MediaRole } from "../media-role";
import { countPrimaryCategories } from "../primary-category";
import { PUBLISHING_ERROR, type PublishingDecision } from "./errors";

export type CategoryRelationInput = {
  categoryId: string;
  isPrimary: boolean;
};

export type TagRelationInput = {
  tagId: string;
};

export type EntityRelationInput = {
  entityId: string;
  sortOrder?: number;
};

export type MediaRelationInput = {
  mediaId: string;
  role: MediaRole;
  sortOrder?: number;
};

export type AuthorRelationInput = {
  authorId: string;
  sortOrder?: number;
};

export type VersionRelationInput = {
  categories?: readonly CategoryRelationInput[];
  tags?: readonly TagRelationInput[];
  entities?: readonly EntityRelationInput[];
  media?: readonly MediaRelationInput[];
  authors?: readonly AuthorRelationInput[];
};

export type CopiedVersionRelations<TCategories, TTags, TEntities, TMedia, TAuthors> = {
  categories: TCategories[];
  tags: TTags[];
  entities: TEntities[];
  media: TMedia[];
  authors: TAuthors[];
};

function hasDuplicateIds(ids: readonly string[]): boolean {
  return new Set(ids).size !== ids.length;
}

function assertNonNegativeSortOrder(
  values: readonly { sortOrder?: number }[],
): PublishingDecision<true> {
  for (const value of values) {
    if (value.sortOrder !== undefined && value.sortOrder < 0) {
      return { ok: false, code: PUBLISHING_ERROR.INVALID_RELATION };
    }
  }

  return { ok: true, value: true };
}

export function assertDraftRelationInputs(
  input: VersionRelationInput,
): PublishingDecision<true> {
  const categories = input.categories ?? [];
  const tags = input.tags ?? [];
  const entities = input.entities ?? [];
  const media = input.media ?? [];
  const authors = input.authors ?? [];

  if (hasDuplicateIds(categories.map((item) => item.categoryId))) {
    return { ok: false, code: PUBLISHING_ERROR.DUPLICATE_RELATION };
  }
  if (hasDuplicateIds(tags.map((item) => item.tagId))) {
    return { ok: false, code: PUBLISHING_ERROR.DUPLICATE_RELATION };
  }
  if (hasDuplicateIds(entities.map((item) => item.entityId))) {
    return { ok: false, code: PUBLISHING_ERROR.DUPLICATE_RELATION };
  }
  if (
    hasDuplicateIds(media.map((item) => `${item.role}:${item.mediaId}`))
  ) {
    return { ok: false, code: PUBLISHING_ERROR.DUPLICATE_RELATION };
  }
  const gallerySortOrders = media
    .filter((item) => item.role === MEDIA_ROLE.GALLERY)
    .map((item) => item.sortOrder)
    .filter((sortOrder): sortOrder is number => sortOrder !== undefined);
  if (hasDuplicateIds(gallerySortOrders.map(String))) {
    return { ok: false, code: PUBLISHING_ERROR.DUPLICATE_RELATION };
  }
  if (hasDuplicateIds(authors.map((item) => item.authorId))) {
    return { ok: false, code: PUBLISHING_ERROR.DUPLICATE_RELATION };
  }

  if (countPrimaryCategories(categories) > 1) {
    return { ok: false, code: PUBLISHING_ERROR.MULTIPLE_PRIMARY_CATEGORIES };
  }

  const heroCount = media.filter((item) => item.role === MEDIA_ROLE.HERO).length;
  if (heroCount > 1) {
    return { ok: false, code: PUBLISHING_ERROR.MULTIPLE_HERO_MEDIA };
  }

  const sortCheck = assertNonNegativeSortOrder([...entities, ...media, ...authors]);
  if (!sortCheck.ok) {
    return sortCheck;
  }

  return { ok: true, value: true };
}

export function copyVersionOwnedRelations<
  TCategories extends object,
  TTags extends object,
  TEntities extends object,
  TMedia extends object,
  TAuthors extends object,
>(source: {
  categories: readonly TCategories[];
  tags: readonly TTags[];
  entities: readonly TEntities[];
  media: readonly TMedia[];
  authors: readonly TAuthors[];
}): CopiedVersionRelations<TCategories, TTags, TEntities, TMedia, TAuthors> {
  return {
    categories: source.categories.map((item) => ({ ...item })),
    tags: source.tags.map((item) => ({ ...item })),
    entities: source.entities.map((item) => ({ ...item })),
    media: source.media.map((item) => ({ ...item })),
    authors: source.authors.map((item) => ({ ...item })),
  };
}
