import "server-only";

import {
  PUBLICATION_STATUS,
  type HomepageSlotKey,
} from "@magazine/domain";
import {
  getEditorContentDetail,
  getHomepageBuilder,
  type EditorHomepageBuilderState,
} from "@magazine/db/editor";
import type { StaffSessionContext } from "@/lib/auth/session";
import { editorScopeFromSession } from "@/lib/content/authorize";
import type {
  HomepageBuilderView,
  HomepageStorySummary,
} from "./builder-types";

function collectContentItemIds(state: EditorHomepageBuilderState): string[] {
  const ids = new Set<string>();
  for (const slot of state.draft.slots) {
    if (slot.contentItemId) {
      ids.add(slot.contentItemId);
    }
  }
  if (state.published) {
    for (const slot of state.published.slots) {
      if (slot.contentItemId) {
        ids.add(slot.contentItemId);
      }
    }
  }
  return [...ids];
}

async function loadStorySummary(contentItemId: string): Promise<HomepageStorySummary | null> {
  const detail = await getEditorContentDetail(contentItemId);
  if (!detail) {
    return null;
  }

  const publishedTitle =
    detail.publishedVersion?.title ??
    (detail.publicationStatus === PUBLICATION_STATUS.PUBLISHED
      ? detail.currentVersion?.title
      : null);
  const displayTitle = detail.currentVersion?.title ?? "Başlıksız";
  const title =
    detail.publicationStatus === PUBLICATION_STATUS.PUBLISHED && publishedTitle
      ? publishedTitle
      : displayTitle;

  const primary =
    detail.currentVersion?.categories.find((category) => category.isPrimary) ??
    detail.currentVersion?.categories[0];

  return {
    id: detail.id,
    slug: detail.slug,
    title,
    publicationStatus: detail.publicationStatus,
    workflowStatus:
      detail.currentVersion?.workflowStatus ??
      detail.publishedVersion?.workflowStatus ??
      "DRAFT",
    primaryCategory: primary
      ? { name: primary.name, slug: primary.slug }
      : null,
    publishedAt: detail.publishedAt?.toISOString() ?? null,
    isPublishEligible:
      detail.publicationStatus === PUBLICATION_STATUS.PUBLISHED &&
      detail.publishedVersionId !== null,
  };
}

async function loadStorySummaries(
  contentItemIds: readonly string[],
): Promise<Record<string, HomepageStorySummary>> {
  const stories: Record<string, HomepageStorySummary> = {};
  await Promise.all(
    contentItemIds.map(async (id) => {
      const summary = await loadStorySummary(id);
      if (summary) {
        stories[id] = summary;
      }
    }),
  );
  return stories;
}

function serializeVersion(
  version: EditorHomepageBuilderState["draft"],
): HomepageBuilderView["draft"] {
  return {
    versionId: version.versionId,
    publishedAt: version.publishedAt?.toISOString() ?? null,
    slots: version.slots.map((slot) => ({
      slotKey: slot.slotKey as HomepageSlotKey,
      contentItemId: slot.contentItemId,
    })),
  };
}

export async function loadHomepageBuilderView(
  session: StaffSessionContext,
): Promise<HomepageBuilderView> {
  const scope = editorScopeFromSession(session);
  const state = await getHomepageBuilder(scope, session.staffUserId);
  const stories = await loadStorySummaries(collectContentItemIds(state));

  return {
    updatedAt: state.updatedAt.toISOString(),
    published: state.published ? serializeVersion(state.published) : null,
    draft: serializeVersion(state.draft),
    stories,
  };
}
