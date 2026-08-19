import "server-only";

import {
  PUBLICATION_STATUS,
  type EditorSafeHeroThumbnail,
  type HomepageSlotKey,
} from "@magazine/domain";
import {
  getEditorContentDetail,
  getEditorVideoAsset,
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
  HomepageVideoSummary,
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

function collectVideoAssetIds(state: EditorHomepageBuilderState): string[] {
  const ids = new Set<string>();
  if (state.draft.videoAssetId) {
    ids.add(state.draft.videoAssetId);
  }
  if (state.published?.videoAssetId) {
    ids.add(state.published.videoAssetId);
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

function videoSummaryFromDetail(
  detail: NonNullable<Awaited<ReturnType<typeof getEditorVideoAsset>>>,
): HomepageVideoSummary {
  return {
    id: detail.id,
    provider: detail.provider,
    providerVideoId: detail.providerVideoId,
    title: detail.title,
    durationSeconds: detail.durationSeconds,
    posterPreviewUrl: detail.posterPreviewUrl,
    posterSource: detail.posterSource,
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

async function loadVideoSummaries(
  videoAssetIds: readonly string[],
  scope: ReturnType<typeof editorScopeFromSession>,
): Promise<Record<string, HomepageVideoSummary>> {
  const details = await Promise.all(
    videoAssetIds.map((id) =>
      getEditorVideoAsset({
        videoAssetId: id,
        roles: scope.roles,
        scopeMode: scope.scopeMode,
        scopedCategoryIds: scope.scopedCategoryIds,
        mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      }),
    ),
  );
  const videos: Record<string, HomepageVideoSummary> = {};
  for (const detail of details) {
    if (!detail) {
      continue;
    }
    videos[detail.id] = videoSummaryFromDetail(detail);
  }
  return videos;
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
    videoAssetId: version.videoAssetId,
  };
}

export async function loadHomepageBuilderView(
  session: StaffSessionContext,
): Promise<HomepageBuilderView> {
  const scope = editorScopeFromSession(session);
  const state = await getHomepageBuilder(scope, session.staffUserId);
  const [stories, videos] = await Promise.all([
    loadStorySummaries(collectContentItemIds(state)),
    loadVideoSummaries(collectVideoAssetIds(state), scope),
  ]);

  return {
    updatedAt: state.updatedAt.toISOString(),
    published: state.published ? serializeVersion(state.published) : null,
    draft: serializeVersion(state.draft),
    stories,
    videos,
  };
}
