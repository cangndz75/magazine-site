export type CategoryLookupOption = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
};

export type AuthorLookupOption = {
  id: string;
  displayName: string;
  slug: string;
};

export type TagLookupOption = {
  id: string;
  name: string;
  slug: string;
};

export type EntityLookupOption = {
  id: string;
  name: string;
  kind: string;
};

export type MediaLookupOption = {
  id: string;
  label: string;
  mediaType: string;
  width: number | null;
  height: number | null;
};

export const ENTITY_KIND_LABELS: Record<string, string> = {
  PERSON: "Kişi",
  ORGANIZATION: "Kuruluş",
  BRAND: "Marka",
  PRODUCTION: "Yapım",
  PLACE: "Yer",
  EVENT: "Etkinlik",
};

export function formatCategoryLabel(category: {
  name: string;
  parentName: string | null;
}): string {
  if (category.parentName) {
    return `${category.parentName} / ${category.name}`;
  }

  return category.name;
}

export function formatAuthorLabel(author: { displayName: string }): string {
  return author.displayName;
}

export function formatTagLabel(tag: { name: string }): string {
  return tag.name;
}

export function formatEntityKindLabel(kind: string): string {
  return ENTITY_KIND_LABELS[kind] ?? "Varlık";
}

export function formatEntityLabel(entity: { name: string; kind: string }): string {
  return `${entity.name} · ${formatEntityKindLabel(entity.kind)}`;
}

export function formatEditorMediaLabel(media: {
  mediaType: string;
  width: number | null;
  height: number | null;
  label?: string;
}): string {
  if (media.label) {
    return media.label;
  }

  const typeLabel =
    media.mediaType === "IMAGE"
      ? "Görsel"
      : media.mediaType === "VIDEO"
        ? "Video"
        : media.mediaType === "AUDIO"
          ? "Ses"
          : "Medya";

  if (media.width && media.height) {
    return `${typeLabel} · ${media.width}×${media.height}`;
  }

  return typeLabel;
}

export function toCategoryPickerOption(category: CategoryLookupOption) {
  return {
    id: category.id,
    label: formatCategoryLabel(category),
    description: category.slug,
  };
}

export function toAuthorPickerOption(author: AuthorLookupOption) {
  return {
    id: author.id,
    label: formatAuthorLabel(author),
    description: author.slug,
  };
}

export function toTagPickerOption(tag: TagLookupOption) {
  return {
    id: tag.id,
    label: formatTagLabel(tag),
    description: tag.slug,
  };
}

export function toEntityPickerOption(entity: EntityLookupOption) {
  return {
    id: entity.id,
    label: entity.name,
    description: formatEntityKindLabel(entity.kind),
  };
}

export function toMediaPickerOption(media: MediaLookupOption) {
  return {
    id: media.id,
    label: formatEditorMediaLabel(media),
    description:
      media.mediaType === "IMAGE"
        ? "Görsel"
        : media.mediaType === "VIDEO"
          ? "Video"
          : media.mediaType === "AUDIO"
            ? "Ses"
            : "Medya",
  };
}
