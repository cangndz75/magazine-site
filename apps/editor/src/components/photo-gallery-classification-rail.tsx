"use client";

import {
  AuthorRelationPicker,
  PrimaryCategoryPicker,
  SecondaryCategoryPicker,
} from "@/components/article-relation-pickers";
import {
  addAuthor,
  removeAuthor,
  setPrimaryCategory,
  setSecondaryCategories,
  type ArticleEditorRelations,
} from "@/lib/content/article-relation-state";
import type {
  AuthorLookupOption,
  CategoryLookupOption,
} from "@/lib/content/lookup-labels";

type PhotoGalleryClassificationRailProps = {
  relations: ArticleEditorRelations;
  disabled: boolean;
  onChange: (next: ArticleEditorRelations) => void;
};

export function PhotoGalleryClassificationRail({
  relations,
  disabled,
  onChange,
}: PhotoGalleryClassificationRailProps) {
  const primary = relations.categories.find((item) => item.isPrimary) ?? null;
  const secondary = relations.categories.filter((item) => !item.isPrimary);

  return (
    <section
      id="editor-section-classification"
      className="scroll-mt-28 space-y-4 rounded border border-zinc-200 bg-white p-4"
    >
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Sınıflandırma</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Kategori ve yazar bilgisi yalnızca açık taslağı değiştirir.
        </p>
      </div>

      <div className="space-y-4">
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
