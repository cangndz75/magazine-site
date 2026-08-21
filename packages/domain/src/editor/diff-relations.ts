import type {
  ContentVersionAuthorDiff,
  ContentVersionDiffAuthorInput,
  ContentVersionCategoryDiff,
  ContentVersionDiffCategoryInput,
  ContentVersionDiffLabel,
  ContentVersionDiffTagInput,
  ContentVersionEntityDiff,
  ContentVersionDiffEntityInput,
  ContentVersionDiffMediaInput,
  ContentVersionMediaDiff,
  ContentVersionDiffVideoInput,
  ContentVersionVideoDiff,
  ContentVersionRelationDiff,
  ContentVersionSetRelationDiff,
} from "./diff-types";

function labelOf(item: { id: string; name?: string; displayName?: string; label?: string; slug?: string }): ContentVersionDiffLabel {
  return {
    id: item.id,
    label: item.name ?? item.displayName ?? item.label ?? item.id,
    slug: item.slug,
  };
}

function orderedIds<T extends { id: string; sortOrder: number }>(items: T[]): string[] {
  return [...items]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map((item) => item.id);
}

function setDiff<T extends { id: string }>(
  before: T[],
  after: T[],
  toLabel: (item: T) => ContentVersionDiffLabel,
): ContentVersionSetRelationDiff {
  const beforeIds = new Set(before.map((item) => item.id));
  const afterIds = new Set(after.map((item) => item.id));
  return {
    added: after.filter((item) => !beforeIds.has(item.id)).map(toLabel),
    removed: before.filter((item) => !afterIds.has(item.id)).map(toLabel),
  };
}

export function diffCategories(
  before: ContentVersionDiffCategoryInput[],
  after: ContentVersionDiffCategoryInput[],
): ContentVersionCategoryDiff {
  const beforePrimary = before.find((item) => item.isPrimary) ?? null;
  const afterPrimary = after.find((item) => item.isPrimary) ?? null;
  const addedRemoved = setDiff(before, after, (item) => ({
    id: item.id,
    label: item.name,
    slug: item.slug,
  }));

  return {
    primary: {
      before: beforePrimary
        ? { id: beforePrimary.id, label: beforePrimary.name, slug: beforePrimary.slug }
        : null,
      after: afterPrimary
        ? { id: afterPrimary.id, label: afterPrimary.name, slug: afterPrimary.slug }
        : null,
      changed: (beforePrimary?.id ?? null) !== (afterPrimary?.id ?? null),
    },
    added: addedRemoved.added,
    removed: addedRemoved.removed,
  };
}

export function diffTags(
  before: ContentVersionDiffTagInput[],
  after: ContentVersionDiffTagInput[],
): ContentVersionSetRelationDiff {
  return setDiff(before, after, (item) => ({
    id: item.id,
    label: item.name,
    slug: item.slug,
  }));
}

export function diffEntities(
  before: ContentVersionDiffEntityInput[],
  after: ContentVersionDiffEntityInput[],
): ContentVersionEntityDiff {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterById = new Map(after.map((item) => [item.id, item]));
  const added = after.filter((item) => !beforeById.has(item.id)).map((item) => ({
    id: item.id,
    label: item.name,
    slug: undefined,
    role: item.role,
    sortOrder: item.sortOrder,
    kind: item.kind,
  }));
  const removed = before.filter((item) => !afterById.has(item.id)).map((item) => ({
    id: item.id,
    label: item.name,
    role: item.role,
    sortOrder: item.sortOrder,
    kind: item.kind,
  }));
  const modified = after.flatMap((item) => {
    const previous = beforeById.get(item.id);
    if (!previous || previous.role === item.role) {
      return [];
    }
    return [
      {
        id: item.id,
        label: item.name,
        beforeRole: previous.role,
        afterRole: item.role,
      },
    ];
  });
  const beforeOrder = orderedIds(before);
  const afterOrder = orderedIds(after);
  const commonBefore = beforeOrder.filter((id) => afterById.has(id));
  const commonAfter = afterOrder.filter((id) => beforeById.has(id));
  const reordered = commonBefore.join("\0") !== commonAfter.join("\0");

  return {
    added,
    removed,
    modified,
    reordered,
    beforeOrder: reordered ? beforeOrder : [],
    afterOrder: reordered ? afterOrder : [],
  };
}

export function diffMedia(
  before: ContentVersionDiffMediaInput[],
  after: ContentVersionDiffMediaInput[],
): ContentVersionMediaDiff {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterById = new Map(after.map((item) => [item.id, item]));
  const added = after.filter((item) => !beforeById.has(item.id)).map((item) => ({
    id: item.id,
    label: item.label,
    role: item.role,
    sortOrder: item.sortOrder,
    caption: item.caption,
    altText: item.altText,
    credit: item.credit,
  }));
  const removed = before.filter((item) => !afterById.has(item.id)).map((item) => ({
    id: item.id,
    label: item.label,
    role: item.role,
    sortOrder: item.sortOrder,
    caption: item.caption,
    altText: item.altText,
    credit: item.credit,
  }));
  const modified = after.flatMap((item) => {
    const previous = beforeById.get(item.id);
    if (!previous) {
      return [];
    }
    if (
      previous.role === item.role &&
      previous.caption === item.caption &&
      previous.altText === item.altText &&
      previous.credit === item.credit
    ) {
      return [];
    }
    return [
      {
        id: item.id,
        label: item.label,
        before: {
          role: previous.role,
          caption: previous.caption,
          altText: previous.altText,
          credit: previous.credit,
        },
        after: {
          role: item.role,
          caption: item.caption,
          altText: item.altText,
          credit: item.credit,
        },
      },
    ];
  });
  const beforeOrder = orderedIds(before);
  const afterOrder = orderedIds(after);
  const commonBefore = beforeOrder.filter((id) => afterById.has(id));
  const commonAfter = afterOrder.filter((id) => beforeById.has(id));
  const reordered = commonBefore.join("\0") !== commonAfter.join("\0");

  return {
    added,
    removed,
    modified,
    reordered,
    beforeOrder: reordered ? beforeOrder : [],
    afterOrder: reordered ? afterOrder : [],
  };
}

export function diffVideos(
  before: ContentVersionDiffVideoInput[],
  after: ContentVersionDiffVideoInput[],
): ContentVersionVideoDiff {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterById = new Map(after.map((item) => [item.id, item]));
  const added = after.filter((item) => !beforeById.has(item.id)).map((item) => ({
    id: item.id,
    label: item.label,
    provider: item.provider,
    sortOrder: item.sortOrder,
    caption: item.caption,
    durationSeconds: item.durationSeconds,
  }));
  const removed = before.filter((item) => !afterById.has(item.id)).map((item) => ({
    id: item.id,
    label: item.label,
    provider: item.provider,
    sortOrder: item.sortOrder,
    caption: item.caption,
    durationSeconds: item.durationSeconds,
  }));
  const modified = after.flatMap((item) => {
    const previous = beforeById.get(item.id);
    if (!previous || previous.caption === item.caption) {
      return [];
    }
    return [
      {
        id: item.id,
        label: item.label,
        before: { caption: previous.caption },
        after: { caption: item.caption },
      },
    ];
  });
  const beforeOrder = orderedIds(before);
  const afterOrder = orderedIds(after);
  const commonBefore = beforeOrder.filter((id) => afterById.has(id));
  const commonAfter = afterOrder.filter((id) => beforeById.has(id));
  const reordered = commonBefore.join("\0") !== commonAfter.join("\0");

  return {
    added,
    removed,
    modified,
    reordered,
    beforeOrder: reordered ? beforeOrder : [],
    afterOrder: reordered ? afterOrder : [],
  };
}

export function diffAuthors(
  before: ContentVersionDiffAuthorInput[],
  after: ContentVersionDiffAuthorInput[],
): ContentVersionAuthorDiff {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterById = new Map(after.map((item) => [item.id, item]));
  const added = after.filter((item) => !beforeById.has(item.id)).map((item) => ({
    id: item.id,
    label: item.displayName,
    slug: item.slug,
    role: item.role,
    sortOrder: item.sortOrder,
  }));
  const removed = before.filter((item) => !afterById.has(item.id)).map((item) => ({
    id: item.id,
    label: item.displayName,
    slug: item.slug,
    role: item.role,
    sortOrder: item.sortOrder,
  }));
  const modified = after.flatMap((item) => {
    const previous = beforeById.get(item.id);
    if (!previous || previous.role === item.role) {
      return [];
    }
    return [
      {
        id: item.id,
        label: item.displayName,
        beforeRole: previous.role,
        afterRole: item.role,
      },
    ];
  });
  const beforeOrder = orderedIds(before);
  const afterOrder = orderedIds(after);
  const commonBefore = beforeOrder.filter((id) => afterById.has(id));
  const commonAfter = afterOrder.filter((id) => beforeById.has(id));
  const reordered = commonBefore.join("\0") !== commonAfter.join("\0");

  return {
    added,
    removed,
    modified,
    reordered,
    beforeOrder: reordered ? beforeOrder : [],
    afterOrder: reordered ? afterOrder : [],
  };
}

export function diffVersionRelations(input: {
  fromCategories: ContentVersionDiffCategoryInput[];
  toCategories: ContentVersionDiffCategoryInput[];
  fromTags: ContentVersionDiffTagInput[];
  toTags: ContentVersionDiffTagInput[];
  fromEntities: ContentVersionDiffEntityInput[];
  toEntities: ContentVersionDiffEntityInput[];
  fromMedia: ContentVersionDiffMediaInput[];
  toMedia: ContentVersionDiffMediaInput[];
  fromVideos: ContentVersionDiffVideoInput[];
  toVideos: ContentVersionDiffVideoInput[];
  fromAuthors: ContentVersionDiffAuthorInput[];
  toAuthors: ContentVersionDiffAuthorInput[];
}): ContentVersionRelationDiff {
  return {
    categories: diffCategories(input.fromCategories, input.toCategories),
    tags: diffTags(input.fromTags, input.toTags),
    entities: diffEntities(input.fromEntities, input.toEntities),
    media: diffMedia(input.fromMedia, input.toMedia),
    videos: diffVideos(input.fromVideos, input.toVideos),
    authors: diffAuthors(input.fromAuthors, input.toAuthors),
  };
}

export { labelOf };
