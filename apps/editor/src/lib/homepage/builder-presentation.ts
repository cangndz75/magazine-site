import "server-only";

import {
  PUBLICATION_STATUS,
  type EditorSafeHeroThumbnail,
  type HomepageSlotKey,
} from "@magazine/domain";
import {
  getEditorContentDetail,
  getHomepageBuilder,
  heroThumbnailForEditorItem,
  loadEditorHeroThumbnailsByVersionIds,
  type EditorHomepageBuilderState,
} from "@magazine/db/editor";
import type { StaffSessionContext } from "@/lib/auth/session";
import { editorScopeFromSession } from "@/lib/content/authorize";
import { env } from "@/lib/env";
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

function storySummaryFromDetail(
  detail: NonNullable<Awaited<ReturnType<typeof getEditorContentDetail>>>,
  thumbnailsByVersionId: ReadonlyMap<string, EditorSafeHeroThumbnail>,
): HomepageStorySummary {
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
    heroThumbnail: heroThumbnailForEditorItem(
      {
        publicationStatus: detail.publicationStatus,
        publishedVersionId: detail.publishedVersionId,
        displayVersionId: detail.currentVersion?.id ?? null,
      },
      thumbnailsByVersionId,
    ),
  };
}

async function loadStorySummaries(
  contentItemIds: readonly string[],
): Promise<Record<string, HomepageStorySummary>> {
  const details = await Promise.all(
    contentItemIds.map((id) => getEditorContentDetail(id)),
  );
  const present = details.filter(
    (detail): detail is NonNullable<typeof detail> => detail !== null,
  );
  const thumbnailsByVersionId = await loadEditorHeroThumbnailsByVersionIds({
    versionIds: [
      ...present
        .map((detail) => detail.publishedVersionId)
        .filter((versionId): versionId is string => versionId !== null),
      ...present
        .map((detail) => detail.currentVersion?.id ?? null)
        .filter((versionId): versionId is string => versionId !== null),
    ],
    mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
  });

  const stories: Record<string, HomepageStorySummary> = {};
  for (const detail of present) {
    stories[detail.id] = storySummaryFromDetail(detail, thumbnailsByVersionId);
  }
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
