export type EditorVersionPointers = {
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  publishedVersionId: string | null;
};

/**
 * Editor presentation pointer only. Never persist this value.
 * Order: current draft, else scheduled, else published.
 */
export function selectEditorDisplayVersionId(
  pointers: EditorVersionPointers,
): string | null {
  return (
    pointers.draftVersionId ??
    pointers.scheduledVersionId ??
    pointers.publishedVersionId
  );
}

export function getPrimaryCategoryId(
  categories: readonly { categoryId: string; isPrimary: boolean }[],
): string | null {
  const primary = categories.filter((category) => category.isPrimary);
  if (primary.length !== 1) {
    return null;
  }

  return primary[0]?.categoryId ?? null;
}
