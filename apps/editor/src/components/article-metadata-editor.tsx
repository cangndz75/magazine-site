"use client";

import {
  AssociatedMediaPicker,
  AuthorRelationPicker,
  EntityRelationPicker,
  PrimaryCategoryPicker,
  SecondaryCategoryPicker,
  TagRelationPicker,
} from "./article-relation-pickers";
import { ArticleHeroSection } from "./article-hero-section";
import {
  addAssociatedMedia,
  addAuthor,
  addEntity,
  addTag,
  getAssociatedMedia,
  getHeroMedia,
  getPrimaryCategory,
  getSecondaryCategories,
  removeAuthor,
  removeEntity,
  removeMedia,
  removeTag,
  setHeroMedia,
  setPrimaryCategory,
  setSecondaryCategories,
  type ArticleEditorRelations,
} from "@/lib/content/article-relation-state";
import type {
  AuthorLookupOption,
  CategoryLookupOption,
  EntityLookupOption,
  MediaLookupOption,
} from "@/lib/content/lookup-labels";

type Props = {
  relations: ArticleEditorRelations;
  disabled: boolean;
  heroBusy: boolean;
  onChange: (next: ArticleEditorRelations) => void;
  onPersistHero: (media: NonNullable<ReturnType<typeof getHeroMedia>>) => void;
  onRemoveHero: () => void;
};

export function ArticleMetadataEditor({
  relations,
  disabled,
  heroBusy,
  onChange,
  onPersistHero,
  onRemoveHero,
}: Props) {
  const primary = getPrimaryCategory(relations);
  const secondary = getSecondaryCategories(relations);
  const hero = getHeroMedia(relations);
  const associated = getAssociatedMedia(relations);

  return (
    <section className="space-y-5 border-t border-zinc-200 pt-6">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Haber bilgileri</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Bu alanlar yalnızca açık taslağı değiştirir. Yayındaki sürüm kaydetmekle
          güncellenmez.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <PrimaryCategoryPicker
          selected={primary ? toCategoryOption(primary) : null}
          disabled={disabled}
          onSelect={(category) =>
            onChange(
              setPrimaryCategory(
                relations,
                category ? fromCategoryOption(category) : null,
              ),
            )
          }
        />
        <SecondaryCategoryPicker
          selected={secondary.map(toCategoryOption)}
          excludedIds={primary ? [primary.id] : []}
          disabled={disabled}
          onAdd={(category) =>
            onChange(
              setSecondaryCategories(relations, [
                ...secondary,
                fromCategoryOption(category),
              ]),
            )
          }
          onRemove={(id) =>
            onChange(
              setSecondaryCategories(
                relations,
                secondary.filter((item) => item.id !== id),
              ),
            )
          }
        />
        <AuthorRelationPicker
          selected={relations.authors.map(toAuthorOption)}
          disabled={disabled}
          onAdd={(author) => onChange(addAuthor(relations, author))}
          onRemove={(id) => onChange(removeAuthor(relations, id))}
        />
        <TagRelationPicker
          selected={relations.tags}
          disabled={disabled}
          onAdd={(tag) => onChange(addTag(relations, tag))}
          onRemove={(id) => onChange(removeTag(relations, id))}
        />
      </div>

      <EntityRelationPicker
        selected={relations.entities.map(toEntityOption)}
        disabled={disabled}
        onAdd={(entity) => onChange(addEntity(relations, entity))}
        onRemove={(id) => onChange(removeEntity(relations, id))}
      />

      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <ArticleHeroSection
            hero={hero}
            disabled={disabled}
            busy={heroBusy}
            onSelect={onPersistHero}
            onRemove={onRemoveHero}
            onPresentationChange={(patch) => {
              if (!hero) {
                return;
              }
              onChange(
                setHeroMedia(relations, {
                  ...hero,
                  altText: patch.altText,
                  credit: patch.credit,
                }),
              );
            }}
          />
        </div>
        <AssociatedMediaPicker
          selected={associated.map(toMediaOption)}
          excludedIds={hero ? [hero.id] : []}
          disabled={disabled}
          onAdd={(media) =>
            onChange(
              addAssociatedMedia(relations, {
                ...toMediaOption(media),
                role: "GALLERY",
                sortOrder: associated.length,
                caption:
                  relations.media.find((item) => item.id === media.id)?.caption ??
                  null,
                altText:
                  relations.media.find((item) => item.id === media.id)?.altText ??
                  null,
                credit:
                  relations.media.find((item) => item.id === media.id)?.credit ??
                  null,
              }),
            )
          }
          onRemove={(id) => onChange(removeMedia(relations, id))}
        />
      </div>
    </section>
  );
}

function toCategoryOption(category: {
  id: string;
  name: string;
  slug: string;
  parentName: string | null;
}): CategoryLookupOption {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: null,
    parentName: category.parentName,
  };
}

function fromCategoryOption(category: CategoryLookupOption) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentName: category.parentName,
    isPrimary: false,
  };
}

function toAuthorOption(author: {
  id: string;
  displayName: string;
  slug: string;
}): AuthorLookupOption {
  return {
    id: author.id,
    displayName: author.displayName,
    slug: author.slug,
  };
}

function toEntityOption(entity: {
  id: string;
  name: string;
  kind: string;
}): EntityLookupOption {
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
  };
}

function toMediaOption(media: {
  id: string;
  label: string;
  mediaType: string;
  width: number | null;
  height: number | null;
}): MediaLookupOption {
  return {
    id: media.id,
    label: media.label,
    mediaType: media.mediaType,
    width: media.width,
    height: media.height,
  };
}
