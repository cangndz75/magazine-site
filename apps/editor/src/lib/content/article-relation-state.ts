import type { AuthorRole, EntityRole, MediaRole } from "@magazine/domain";
import { AUTHOR_ROLE, ENTITY_ROLE, MEDIA_ROLE } from "@magazine/domain";

export type ArticleEditorCategory = {
  id: string;
  name: string;
  slug: string;
  parentName: string | null;
  isPrimary: boolean;
};

export type ArticleEditorAuthor = {
  id: string;
  displayName: string;
  slug: string;
  role: AuthorRole;
  sortOrder: number;
};

export type ArticleEditorTag = {
  id: string;
  name: string;
  slug: string;
};

export type ArticleEditorEntity = {
  id: string;
  name: string;
  kind: string;
  role: EntityRole;
  sortOrder: number;
};

export type ArticleEditorMediaEligibility = {
  eligible: boolean;
  status: string;
  reasons: string[];
};

export type ArticleEditorMedia = {
  id: string;
  label: string;
  mediaType: string;
  width: number | null;
  height: number | null;
  role: MediaRole;
  sortOrder: number;
  caption: string | null;
  altText: string | null;
  credit: string | null;
  previewUrl?: string | null;
  creatorName?: string | null;
  creditLine?: string | null;
  eligibility?: ArticleEditorMediaEligibility | null;
};

export type ArticleEditorRelations = {
  categories: ArticleEditorCategory[];
  authors: ArticleEditorAuthor[];
  tags: ArticleEditorTag[];
  entities: ArticleEditorEntity[];
  media: ArticleEditorMedia[];
};

export const ARTICLE_EDITOR_EMPTY_RELATIONS: ArticleEditorRelations = {
  categories: [],
  authors: [],
  tags: [],
  entities: [],
  media: [],
};

export function cloneArticleEditorRelations(
  relations: ArticleEditorRelations,
): ArticleEditorRelations {
  return {
    categories: relations.categories.map((item) => ({ ...item })),
    authors: relations.authors.map((item) => ({ ...item })),
    tags: relations.tags.map((item) => ({ ...item })),
    entities: relations.entities.map((item) => ({ ...item })),
    media: relations.media.map((item) => ({ ...item })),
  };
}

export function getPrimaryCategory(
  relations: ArticleEditorRelations,
): ArticleEditorCategory | null {
  return relations.categories.find((item) => item.isPrimary) ?? null;
}

export function getSecondaryCategories(
  relations: ArticleEditorRelations,
): ArticleEditorCategory[] {
  return relations.categories.filter((item) => !item.isPrimary);
}

export function getHeroMedia(
  relations: ArticleEditorRelations,
): ArticleEditorMedia | null {
  return relations.media.find((item) => item.role === MEDIA_ROLE.HERO) ?? null;
}

export function getAssociatedMedia(
  relations: ArticleEditorRelations,
): ArticleEditorMedia[] {
  return relations.media.filter((item) => item.role !== MEDIA_ROLE.HERO);
}

export function setPrimaryCategory(
  relations: ArticleEditorRelations,
  category: ArticleEditorCategory | null,
): ArticleEditorRelations {
  const secondary = getSecondaryCategories(relations).filter(
    (item) => item.id !== category?.id,
  );
  return {
    ...relations,
    categories: category
      ? [{ ...category, isPrimary: true }, ...secondary]
      : secondary,
  };
}

export function setSecondaryCategories(
  relations: ArticleEditorRelations,
  categories: ArticleEditorCategory[],
): ArticleEditorRelations {
  const primary = getPrimaryCategory(relations);
  const unique = new Map<string, ArticleEditorCategory>();
  for (const category of categories) {
    if (primary && category.id === primary.id) {
      continue;
    }
    unique.set(category.id, { ...category, isPrimary: false });
  }
  return {
    ...relations,
    categories: primary
      ? [{ ...primary, isPrimary: true }, ...unique.values()]
      : [...unique.values()],
  };
}

export function setAuthors(
  relations: ArticleEditorRelations,
  authors: ArticleEditorAuthor[],
): ArticleEditorRelations {
  const unique = new Map<string, ArticleEditorAuthor>();
  for (const author of authors) {
    unique.set(author.id, author);
  }
  return {
    ...relations,
    authors: [...unique.values()].map((author, index) => ({
      ...author,
      sortOrder: index,
    })),
  };
}

export function addAuthor(
  relations: ArticleEditorRelations,
  author: Omit<ArticleEditorAuthor, "role" | "sortOrder"> & {
    role?: AuthorRole;
  },
): ArticleEditorRelations {
  if (relations.authors.some((item) => item.id === author.id)) {
    return relations;
  }
  return setAuthors(relations, [
    ...relations.authors,
    {
      ...author,
      role: author.role ?? AUTHOR_ROLE.AUTHOR,
      sortOrder: relations.authors.length,
    },
  ]);
}

export function removeAuthor(
  relations: ArticleEditorRelations,
  authorId: string,
): ArticleEditorRelations {
  return setAuthors(
    relations,
    relations.authors.filter((item) => item.id !== authorId),
  );
}

export function addTag(
  relations: ArticleEditorRelations,
  tag: ArticleEditorTag,
): ArticleEditorRelations {
  if (relations.tags.some((item) => item.id === tag.id)) {
    return relations;
  }
  return { ...relations, tags: [...relations.tags, tag] };
}

export function removeTag(
  relations: ArticleEditorRelations,
  tagId: string,
): ArticleEditorRelations {
  return {
    ...relations,
    tags: relations.tags.filter((item) => item.id !== tagId),
  };
}

export function addEntity(
  relations: ArticleEditorRelations,
  entity: Omit<ArticleEditorEntity, "role" | "sortOrder"> & {
    role?: EntityRole;
  },
): ArticleEditorRelations {
  if (relations.entities.some((item) => item.id === entity.id)) {
    return relations;
  }
  return {
    ...relations,
    entities: [
      ...relations.entities,
      {
        ...entity,
        role: entity.role ?? ENTITY_ROLE.SUBJECT,
        sortOrder: relations.entities.length,
      },
    ].map((item, index) => ({ ...item, sortOrder: index })),
  };
}

export function removeEntity(
  relations: ArticleEditorRelations,
  entityId: string,
): ArticleEditorRelations {
  return {
    ...relations,
    entities: relations.entities
      .filter((item) => item.id !== entityId)
      .map((item, index) => ({ ...item, sortOrder: index })),
  };
}

export function setHeroMedia(
  relations: ArticleEditorRelations,
  media: ArticleEditorMedia | null,
): ArticleEditorRelations {
  const others = getAssociatedMedia(relations).filter(
    (item) => item.id !== media?.id,
  );
  const nextHero = media
    ? {
        ...media,
        role: MEDIA_ROLE.HERO,
        sortOrder: 0,
      }
    : null;
  return {
    ...relations,
    media: nextHero
      ? [nextHero, ...others.map((item, index) => ({ ...item, sortOrder: index + 1 }))]
      : others.map((item, index) => ({ ...item, sortOrder: index })),
  };
}

export function addAssociatedMedia(
  relations: ArticleEditorRelations,
  media: ArticleEditorMedia,
): ArticleEditorRelations {
  if (relations.media.some((item) => item.id === media.id)) {
    return relations;
  }
  const hero = getHeroMedia(relations);
  const others = [
    ...getAssociatedMedia(relations),
    {
      ...media,
      role: media.role === MEDIA_ROLE.HERO ? MEDIA_ROLE.GALLERY : media.role,
    },
  ];
  return {
    ...relations,
    media: hero
      ? [
          { ...hero, sortOrder: 0 },
          ...others.map((item, index) => ({ ...item, sortOrder: index + 1 })),
        ]
      : others.map((item, index) => ({ ...item, sortOrder: index })),
  };
}

export function removeMedia(
  relations: ArticleEditorRelations,
  mediaId: string,
): ArticleEditorRelations {
  const remaining = relations.media.filter((item) => item.id !== mediaId);
  return {
    ...relations,
    media: remaining.map((item, index) => ({ ...item, sortOrder: index })),
  };
}

export function articleEditorRelationsEqual(
  left: ArticleEditorRelations,
  right: ArticleEditorRelations,
): boolean {
  return (
    JSON.stringify(normalizeArticleEditorRelations(left)) ===
    JSON.stringify(normalizeArticleEditorRelations(right))
  );
}

export function normalizeArticleEditorRelations(
  relations: ArticleEditorRelations,
): ArticleEditorRelations {
  const primary = getPrimaryCategory(relations);
  const secondary = getSecondaryCategories(relations)
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    categories: primary
      ? [{ ...primary, isPrimary: true }, ...secondary.map((item) => ({ ...item, isPrimary: false }))]
      : secondary.map((item) => ({ ...item, isPrimary: false })),
    tags: relations.tags
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => ({ id: item.id, name: item.name, slug: item.slug })),
    authors: relations.authors
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
      .map((item, index) => ({
        id: item.id,
        displayName: item.displayName,
        slug: item.slug,
        role: item.role,
        sortOrder: index,
      })),
    entities: relations.entities
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
      .map((item, index) => ({
        id: item.id,
        name: item.name,
        kind: item.kind,
        role: item.role,
        sortOrder: index,
      })),
    media: relations.media
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
      .map((item, index) => ({
        id: item.id,
        label: item.label,
        mediaType: item.mediaType,
        width: item.width,
        height: item.height,
        role: item.role,
        sortOrder: index,
        caption: item.caption,
        altText: item.altText,
        credit: item.credit,
      })),
  };
}

export function toDraftRelationPayload(relations: ArticleEditorRelations) {
  const normalized = normalizeArticleEditorRelations(relations);
  return {
    categories: normalized.categories.map((item) => ({
      categoryId: item.id,
      isPrimary: item.isPrimary,
    })),
    tags: normalized.tags.map((item) => ({ tagId: item.id })),
    entities: normalized.entities.map((item) => ({
      entityId: item.id,
      role: item.role,
      sortOrder: item.sortOrder,
    })),
    media: normalized.media.map((item) => ({
      mediaId: item.id,
      role: item.role,
      sortOrder: item.sortOrder,
      caption: item.caption,
      altText: item.altText,
      credit: item.credit,
    })),
    authors: normalized.authors.map((item) => ({
      authorId: item.id,
      role: item.role,
      sortOrder: item.sortOrder,
    })),
  };
}

export function mergeSelectedLookupOptions<T extends { id: string }>(
  selected: readonly T[],
  options: readonly T[],
): T[] {
  const merged = [...options];
  for (const item of selected) {
    if (!merged.some((option) => option.id === item.id)) {
      merged.unshift(item);
    }
  }
  return merged;
}

export function isFocusedVersionEditableDraft(input: {
  canEditPermission: boolean;
  workflowStatus: string | null;
  focusedVersionId: string | null;
  draftVersionId: string | null;
}): boolean {
  return (
    input.canEditPermission &&
    input.workflowStatus === "DRAFT" &&
    input.focusedVersionId !== null &&
    input.focusedVersionId === input.draftVersionId
  );
}
