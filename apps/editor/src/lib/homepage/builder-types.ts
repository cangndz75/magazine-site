import type { PublicationStatus, WorkflowStatus } from "@magazine/domain";
import type { HomepageSlotKey, EditorSafeHeroThumbnail } from "@magazine/domain";

export type HomepageStorySummary = {
  id: string;
  slug: string;
  title: string;
  publicationStatus: PublicationStatus;
  workflowStatus: WorkflowStatus;
  primaryCategory: { name: string; slug: string } | null;
  publishedAt: string | null;
  isPublishEligible: boolean;
  heroThumbnail: EditorSafeHeroThumbnail | null;
};

export type HomepageBuilderSlotView = {
  slotKey: HomepageSlotKey;
  contentItemId: string | null;
};

export type HomepageBuilderVersionView = {
  versionId: string;
  publishedAt: string | null;
  slots: HomepageBuilderSlotView[];
};

export type HomepageBuilderView = {
  updatedAt: string;
  published: HomepageBuilderVersionView | null;
  draft: HomepageBuilderVersionView;
  stories: Record<string, HomepageStorySummary>;
};

export type HomepageBuilderMutationResponse = {
  builder: HomepageBuilderView;
};
