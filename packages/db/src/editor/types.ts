import type {
  AuthorRole,
  EditorSafeHeroThumbnail,
  EntityKind,
  EntityRole,
  MediaRole,
  MediaType,
  NewsroomSort,
  NewsroomView,
  PublicationStatus,
  ReviewEventType,
  WorkflowStatus,
} from "@magazine/domain";

export type EditorStaffQueryScope = {
  scopedCategoryIds: readonly string[] | null;
};

export type EditorContentListFilters = {
  limit: number;
  cursor?: { updatedAt: string; id: string } | null;
  search?: string | null;
  publicationStatus?: PublicationStatus;
  workflowStatus?: WorkflowStatus;
  categoryId?: string;
  authorId?: string;
  scheduledOnly?: boolean;
  view?: NewsroomView;
  sort?: NewsroomSort;
};

export type EditorRevisionHistoryFilters = {
  limit: number;
  cursor?: { versionNumber: number; id: string } | null;
};

export type EditorReviewQueueFilters = {
  limit: number;
  cursor?: { submittedAt: string; id: string } | null;
  search?: string | null;
  publicationStatus?: PublicationStatus;
  categoryId?: string;
  authorId?: string;
};

export type EditorListAuthorSummary = {
  id: string;
  displayName: string;
  slug: string;
};

export type EditorListPrimaryCategory = {
  id: string;
  name: string;
  slug: string;
};

export type EditorContentListRow = {
  id: string;
  slug: string;
  publicationStatus: PublicationStatus;
  displayVersion: {
    id: string;
    versionNumber: number;
    workflowStatus: WorkflowStatus;
    title: string;
    excerpt: string | null;
  };
  publishedVersionId: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  publicDateModified: Date | null;
  primaryCategory: EditorListPrimaryCategory | null;
  authors: EditorListAuthorSummary[];
  updatedAt: Date;
  heroThumbnail: EditorSafeHeroThumbnail | null;
  legalHoldAt: Date | null;
  retractedAt: Date | null;
  takedownAt: Date | null;
  changesRequestedNote: string | null;
  entityCount: number;
};

export type EditorRevisionHistoryRow = {
  id: string;
  contentItemId: string;
  versionNumber: number;
  workflowStatus: WorkflowStatus;
  title: string;
  excerpt: string | null;
  createdAt: Date;
  isCurrentDraft: boolean;
  isScheduledVersion: boolean;
  isPublishedVersion: boolean;
};

export type EditorReviewHistoryActor = {
  id: string;
  displayName: string;
};

export type EditorReviewHistoryRow = {
  id: string;
  contentItemId: string;
  contentVersionId: string;
  eventType: ReviewEventType;
  actor: EditorReviewHistoryActor;
  note: string | null;
  createdAt: Date;
};

export type EditorReviewHistoryFilters = {
  versionId?: string;
};

export type EditorReviewQueueRow = {
  contentItemId: string;
  versionId: string;
  versionNumber: number;
  slug: string;
  title: string;
  excerpt: string | null;
  workflowStatus: WorkflowStatus;
  publicationStatus: PublicationStatus;
  createdAt: Date;
  latestSubmittedAt: Date;
  reviewRound: number;
  publishedVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: Date | null;
  primaryCategory: EditorListPrimaryCategory | null;
  secondaryCategories: EditorListPrimaryCategory[];
  authors: EditorListAuthorSummary[];
};

export type EditorVersionSummary = {
  id: string;
  versionNumber: number;
  workflowStatus: WorkflowStatus;
  title: string;
};

export type EditorContentDetail = {
  id: string;
  slug: string;
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: Date | null;
  scheduleGeneration: number;
  publishedAt: Date | null;
  publicDateModified: Date | null;
  updatedAt: Date;
  currentVersion: {
    id: string;
    versionNumber: number;
    workflowStatus: WorkflowStatus;
    title: string;
    subtitle: string | null;
    excerpt: string | null;
    body: unknown;
    seoTitle: string | null;
    seoDescription: string | null;
    canonicalUrl: string | null;
    robots: string | null;
    credibility: string | null;
    credibilitySource: string | null;
    source: string | null;
    sourceOrganization: string | null;
    sourceUrl: string | null;
    syndicated: boolean;
    isMaterialUpdate: boolean;
    createdAt: Date;
    categories: {
      id: string;
      name: string;
      slug: string;
      isPrimary: boolean;
    }[];
    tags: { id: string; name: string; slug: string }[];
    entities: {
      id: string;
      name: string;
      kind: EntityKind;
      role: EntityRole;
      sortOrder: number;
    }[];
    media: {
      id: string;
      mediaType: MediaType;
      label: string;
      width: number | null;
      height: number | null;
      role: MediaRole;
      sortOrder: number;
      caption: string | null;
      altText: string | null;
      credit: string | null;
    }[];
    authors: {
      id: string;
      displayName: string;
      slug: string;
      role: AuthorRole;
      sortOrder: number;
    }[];
  } | null;
  publishedVersion: EditorVersionSummary | null;
  draftVersion: EditorVersionSummary | null;
  scheduledVersion: EditorVersionSummary | null;
};

export type EditorContentAccess = {
  id: string;
  updatedAt: Date;
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: Date | null;
  scheduleGeneration: number;
  displayVersionId: string | null;
  displayPrimaryCategoryId: string | null;
  displayCategoryIds: string[];
  draftPrimaryCategoryId: string | null;
  draftCategoryIds: string[];
  publishedPrimaryCategoryId: string | null;
  publishedCategoryIds: string[];
  scheduledPrimaryCategoryId: string | null;
  scheduledCategoryIds: string[];
};

export type OwnedVersionCategories = {
  versionId: string;
  primaryCategoryId: string | null;
  categoryIds: string[];
};
