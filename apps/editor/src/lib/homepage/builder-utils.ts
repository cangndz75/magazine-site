import { PUBLICATION_STATUS, type HomepageSlotKey } from "@magazine/domain";
import { formatEditorialDateTime } from "@/lib/content/editorial-timezone";
import type {
  HomepageBuilderView,
  HomepageStorySummary,
} from "./builder-types";
import { HOMEPAGE_SLOT_LABEL } from "./slot-meta";

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

export function slotMapFromVersion(
  version: HomepageBuilderView["draft"],
): Map<HomepageSlotKey, string | null> {
  const map = new Map<HomepageSlotKey, string | null>();
  for (const slot of version.slots) {
    map.set(slot.slotKey, slot.contentItemId);
  }
  return map;
}

export function findSlotForContentItem(
  version: HomepageBuilderView["draft"],
  contentItemId: string,
): HomepageSlotKey | null {
  for (const slot of version.slots) {
    if (slot.contentItemId === contentItemId) {
      return slot.slotKey;
    }
  }
  return null;
}

export function countDraftChanges(builder: HomepageBuilderView): number {
  const publishedMap = builder.published
    ? slotMapFromVersion(builder.published)
    : new Map<HomepageSlotKey, string | null>();
  const draftMap = slotMapFromVersion(builder.draft);
  let changes = 0;
  for (const [key, draftId] of draftMap.entries()) {
    const publishedId = publishedMap.get(key) ?? null;
    if (draftId !== publishedId) {
      changes += 1;
    }
  }
  return changes;
}

export function countEmptySlots(builder: HomepageBuilderView): number {
  return builder.draft.slots.filter((slot) => slot.contentItemId === null).length;
}

export type PublishEligibility = {
  assignedCount: number;
  eligibleCount: number;
  blockingCount: number;
  emptyCount: number;
  blockers: Array<{ slotKey: HomepageSlotKey; title: string }>;
};

export function analyzePublishEligibility(
  builder: HomepageBuilderView,
): PublishEligibility {
  const blockers: PublishEligibility["blockers"] = [];
  let assignedCount = 0;
  let eligibleCount = 0;

  for (const slot of builder.draft.slots) {
    if (!slot.contentItemId) {
      continue;
    }
    assignedCount += 1;
    const story = builder.stories[slot.contentItemId];
    if (story?.isPublishEligible) {
      eligibleCount += 1;
    } else {
      blockers.push({
        slotKey: slot.slotKey,
        title: story?.title ?? "Bilinmeyen içerik",
      });
    }
  }

  return {
    assignedCount,
    eligibleCount,
    blockingCount: blockers.length,
    emptyCount: countEmptySlots(builder),
    blockers,
  };
}

export function slotAssignmentLabel(slotKey: HomepageSlotKey): string {
  return HOMEPAGE_SLOT_LABEL[slotKey];
}

export function isStoryPublishEligible(story: HomepageStorySummary): boolean {
  return story.isPublishEligible;
}

export function isStoryPublished(story: HomepageStorySummary): boolean {
  return story.publicationStatus === PUBLICATION_STATUS.PUBLISHED;
}

export function formatHomepageLivePublishedLabel(
  publishedAt: string | null | undefined,
): string | null {
  if (!publishedAt) {
    return null;
  }
  return formatEditorialDateTime(publishedAt);
}
