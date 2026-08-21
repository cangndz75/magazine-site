"use client";

import {
  AuthorRelationPicker,
  PrimaryCategoryPicker,
  SecondaryCategoryPicker,
  TagRelationPicker,
} from "./article-relation-pickers";
import { ArticleHeroSection } from "./article-hero-section";
import { ArticleGallerySection } from "./article-gallery-section";
import { ArticleVideoSection } from "./article-video-section";
import {
  addAuthor,
  addEntity,
  addTag,
  getArticleVideos,
  getGalleryMedia,
  getHeroMedia,
  getPrimaryCategory,
  getSecondaryCategories,
  removeAuthor,
  removeEntity,
  removeTag,
  reorderEntity,
  setEntityRole,
  setGalleryMedia,
  setHeroMedia,
  setPrimaryCategory,
  setSecondaryCategories,
  type ArticleEditorMedia,
  type ArticleEditorRelations,
  type ArticleEditorVideo,
} from "@/lib/content/article-relation-state";
import { ArticleEntityRelationsSection } from "./article-entity-relations-section";
import type {
  AuthorLookupOption,
  CategoryLookupOption,
  EntityLookupOption,
} from "@/lib/content/lookup-labels";

type Props = {
  relations: ArticleEditorRelations;
  disabled: boolean;
  heroBusy: boolean;
  galleryBusy: boolean;
  videoBusy: boolean;
  onChange: (next: ArticleEditorRelations) => void;
  onPersistHero: (media: NonNullable<ReturnType<typeof getHeroMedia>>) => void;
  onRemoveHero: () => void;
  onPersistGallery: (gallery: ArticleEditorMedia[]) => void;
  onPersistVideos: (videos: ArticleEditorVideo[]) => void;
};

export function ArticleMetadataEditor({
  relations,
  disabled,
  heroBusy,
  galleryBusy,
  videoBusy,
  onChange,
  onPersistHero,
  onRemoveHero,
  onPersistGallery,
  onPersistVideos,
}: Props) {
  const primary = getPrimaryCategory(relations);
  const secondary = getSecondaryCategories(relations);
  const hero = getHeroMedia(relations);
  const gallery = getGalleryMedia(relations);
  const videos = getArticleVideos(relations);

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

      <ArticleEntityRelationsSection
        entities={relations.entities}
        disabled={disabled}
        onAdd={(entity) => onChange(addEntity(relations, entity))}
        onRemove={(id) => onChange(removeEntity(relations, id))}
        onRoleChange={(entityId, role) =>
          onChange(setEntityRole(relations, entityId, role))
        }
        onMove={(entityId, direction) =>
          onChange(reorderEntity(relations, entityId, direction))
        }
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
        <ArticleGallerySection
          gallery={gallery}
          disabled={disabled}
          busy={galleryBusy}
          onChange={(next) => onChange(setGalleryMedia(relations, next))}
          onPersist={onPersistGallery}
        />
        <ArticleVideoSection
          videos={videos}
          disabled={disabled}
          busy={videoBusy}
          onPersist={onPersistVideos}
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
  status?: string;
}): EntityLookupOption {
  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
  };
}
