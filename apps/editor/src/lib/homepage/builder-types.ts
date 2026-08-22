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

export type HomepageVideoSummary = {
  id: string;
  provider: string;
  providerVideoId: string;
  title: string;
  durationSeconds: number | null;
  posterPreviewUrl: string | null;
  posterSource: "EDITORIAL" | "PROVIDER" | "NONE";
};

export type HomepageBuilderSlotView = {
  slotKey: HomepageSlotKey;
  contentItemId: string | null;
};

export type HomepageBuilderVersionView = {
  versionId: string;
  publishedAt: string | null;
  slots: HomepageBuilderSlotView[];
  videoAssetId: string | null;
};

export type HomepageConversationItemView = {
  id: string;
  rank: number;
  label: string;
  reason: string | null;
  contentItemId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HomepageConversationView = {
  updatedAt: string;
  maxItems: number;
  items: HomepageConversationItemView[];
};

export type HomepageBuilderView = {
  updatedAt: string;
  published: HomepageBuilderVersionView | null;
  draft: HomepageBuilderVersionView;
  stories: Record<string, HomepageStorySummary>;
  videos: Record<string, HomepageVideoSummary>;
  conversation: HomepageConversationView;
};

export type HomepageBuilderMutationResponse = {
  builder: HomepageBuilderView;
};
