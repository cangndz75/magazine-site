import {
  authorizeEditorContentMutation,
  getPrimaryCategoryId,
  selectEditorDisplayVersionId,
  type EditorStaffScope,
  type EditorVersionPointers,
} from "@magazine/domain";
import { unwrapPublishingDecision } from "./errors";
import type { PublishingTx } from "./db-types";
import { loadVersionRelations } from "./relations";

export type LockedCategoryState = {
  primaryCategoryId: string | null;
  categoryIds: string[];
};

export async function loadLockedVersionCategories(
  tx: PublishingTx,
  versionId: string | null,
): Promise<LockedCategoryState> {
  if (!versionId) {
    return { primaryCategoryId: null, categoryIds: [] };
  }

  const relations = await loadVersionRelations(tx, versionId);
  const categories = relations.categories ?? [];
  return {
    primaryCategoryId: getPrimaryCategoryId(categories),
    categoryIds: categories.map((category) => category.categoryId),
  };
}

export async function loadLockedDisplayCategories(
  tx: PublishingTx,
  item: EditorVersionPointers,
): Promise<LockedCategoryState> {
  return loadLockedVersionCategories(tx, selectEditorDisplayVersionId(item));
}

/**
 * Post-lock authorization for the exact review-target version.
 * Queue and review actions use this version's categories, not the published pointer.
 */
export async function authorizeLockedReviewTarget(
  tx: PublishingTx,
  versionId: string,
  scope: EditorStaffScope,
): Promise<void> {
  const target = await loadLockedVersionCategories(tx, versionId);
  unwrapPublishingDecision(
    authorizeEditorContentMutation({
      ...scope,
      currentPrimaryCategoryId: target.primaryCategoryId,
      nextCategoryIds: target.categoryIds,
      nextPrimaryCategoryId: target.primaryCategoryId,
    }),
  );
}

/**
 * Category authorization that must run after ContentItem FOR UPDATE.
 * Loads current display-version categories from the locked row's pointers.
 */
export async function authorizeLockedEditorMutation(
  tx: PublishingTx,
  item: EditorVersionPointers,
  scope: EditorStaffScope,
  next: {
    categoryIds?: readonly string[];
    primaryCategoryId?: string | null;
    requireSelectedPrimary?: boolean;
  } = {},
): Promise<void> {
  const current = await loadLockedDisplayCategories(tx, item);
  unwrapPublishingDecision(
    authorizeEditorContentMutation({
      ...scope,
      currentPrimaryCategoryId: current.primaryCategoryId,
      nextCategoryIds: next.categoryIds,
      nextPrimaryCategoryId: next.primaryCategoryId,
      requireSelectedPrimary: next.requireSelectedPrimary,
    }),
  );
}
