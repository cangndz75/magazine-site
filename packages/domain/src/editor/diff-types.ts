export const DIFF_CHANGE_TYPE = {
  UNCHANGED: "UNCHANGED",
  ADDED: "ADDED",
  REMOVED: "REMOVED",
  MODIFIED: "MODIFIED",
  MOVED: "MOVED",
} as const;

export type DiffChangeType =
  (typeof DIFF_CHANGE_TYPE)[keyof typeof DIFF_CHANGE_TYPE];

export const DIFF_INLINE_TYPE = {
  EQUAL: "EQUAL",
  ADDED: "ADDED",
  REMOVED: "REMOVED",
} as const;

export type DiffInlineType =
  (typeof DIFF_INLINE_TYPE)[keyof typeof DIFF_INLINE_TYPE];

export const DIFF_DETAIL_LIMIT = "DIFF_DETAIL_LIMIT";

export const DIFF_MAX_BLOCKS = 400;
export const DIFF_MAX_INLINE_TOKENS = 2000;
export const DIFF_MAX_BLOCK_TEXT_CHARS = 20_000;

export type ContentVersionDiffSummaryPointers = {
  isCurrentDraft: boolean;
  isPublishedVersion: boolean;
  isScheduledVersion: boolean;
};

export type ContentVersionDiffVersion = {
  id: string;
  versionNumber: number;
  workflowStatus: string;
  createdAt: Date;
  isCurrentDraft: boolean;
  isPublishedVersion: boolean;
  isScheduledVersion: boolean;
};

export type ContentVersionFieldDiff = {
  field: string;
  changeType: "ADDED" | "REMOVED" | "MODIFIED";
  before: string | boolean | null;
  after: string | boolean | null;
};

export type ContentVersionInlineChange = {
  type: DiffInlineType;
  text: string;
};

export type ContentVersionBlockDiff = {
  changeType: "ADDED" | "REMOVED" | "MODIFIED" | "MOVED";
  blockType: string;
  fromIndex: number | null;
  toIndex: number | null;
  beforeText: string | null;
  afterText: string | null;
  inlineChanges?: ContentVersionInlineChange[];
  inlineDetailLimited?: boolean;
  links?: {
    before: string[];
    after: string[];
    changed: boolean;
  };
};

export type ContentVersionBodyDiff = {
  changed: boolean;
  detailLimited: boolean;
  blocks: ContentVersionBlockDiff[];
};

export type ContentVersionDiffLabel = {
  id: string;
  label: string;
  slug?: string;
};

export type ContentVersionPrimaryCategoryDiff = {
  before: ContentVersionDiffLabel | null;
  after: ContentVersionDiffLabel | null;
  changed: boolean;
};

export type ContentVersionSetRelationDiff = {
  added: ContentVersionDiffLabel[];
  removed: ContentVersionDiffLabel[];
};

export type ContentVersionEntityDiffItem = ContentVersionDiffLabel & {
  role: string;
  sortOrder: number;
  kind?: string;
};

export type ContentVersionEntityModified = {
  id: string;
  label: string;
  beforeRole: string;
  afterRole: string;
};

export type ContentVersionEntityDiff = {
  added: ContentVersionEntityDiffItem[];
  removed: ContentVersionEntityDiffItem[];
  modified: ContentVersionEntityModified[];
  reordered: boolean;
  beforeOrder: string[];
  afterOrder: string[];
};

export type ContentVersionMediaDiffItem = ContentVersionDiffLabel & {
  role: string;
  sortOrder: number;
  caption: string | null;
  altText: string | null;
  credit: string | null;
};

export type ContentVersionMediaModified = {
  id: string;
  label: string;
  before: {
    role: string;
    caption: string | null;
    altText: string | null;
    credit: string | null;
  };
  after: {
    role: string;
    caption: string | null;
    altText: string | null;
    credit: string | null;
  };
};

export type ContentVersionMediaDiff = {
  added: ContentVersionMediaDiffItem[];
  removed: ContentVersionMediaDiffItem[];
  modified: ContentVersionMediaModified[];
  reordered: boolean;
  beforeOrder: string[];
  afterOrder: string[];
};

export type ContentVersionAuthorDiffItem = ContentVersionDiffLabel & {
  role: string;
  sortOrder: number;
};

export type ContentVersionAuthorModified = {
  id: string;
  label: string;
  beforeRole: string;
  afterRole: string;
};

export type ContentVersionAuthorDiff = {
  added: ContentVersionAuthorDiffItem[];
  removed: ContentVersionAuthorDiffItem[];
  modified: ContentVersionAuthorModified[];
  reordered: boolean;
  beforeOrder: string[];
  afterOrder: string[];
};

export type ContentVersionCategoryDiff = {
  primary: ContentVersionPrimaryCategoryDiff;
  added: ContentVersionDiffLabel[];
  removed: ContentVersionDiffLabel[];
};

export type ContentVersionRelationDiff = {
  categories: ContentVersionCategoryDiff;
  tags: ContentVersionSetRelationDiff;
  entities: ContentVersionEntityDiff;
  media: ContentVersionMediaDiff;
  authors: ContentVersionAuthorDiff;
};

export type ContentVersionDiffSummary = {
  changed: boolean;
  scalarFieldsChanged: number;
  blocksAdded: number;
  blocksRemoved: number;
  blocksModified: number;
  blocksMoved: number;
  bodyDetailLimited: boolean;
  categoriesAdded: number;
  categoriesRemoved: number;
  primaryCategoryChanged: boolean;
  tagsAdded: number;
  tagsRemoved: number;
  entitiesChanged: boolean;
  mediaChanged: boolean;
  authorsChanged: boolean;
};

export type ContentVersionDiff = {
  contentItemId: string;
  fromVersion: ContentVersionDiffVersion;
  toVersion: ContentVersionDiffVersion;
  summary: ContentVersionDiffSummary;
  fields: ContentVersionFieldDiff[];
  body: ContentVersionBodyDiff;
  relations: ContentVersionRelationDiff;
};

export type ContentVersionDiffScalarSnapshot = {
  title: string;
  subtitle: string | null;
  excerpt: string | null;
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
};

export type ContentVersionDiffCategoryInput = {
  id: string;
  name: string;
  slug: string;
  isPrimary: boolean;
};

export type ContentVersionDiffTagInput = {
  id: string;
  name: string;
  slug: string;
};

export type ContentVersionDiffEntityInput = {
  id: string;
  name: string;
  kind?: string;
  role: string;
  sortOrder: number;
};

export type ContentVersionDiffMediaInput = {
  id: string;
  label: string;
  role: string;
  sortOrder: number;
  caption: string | null;
  altText: string | null;
  credit: string | null;
};

export type ContentVersionDiffAuthorInput = {
  id: string;
  displayName: string;
  slug: string;
  role: string;
  sortOrder: number;
};

export type ContentVersionDiffSideInput = ContentVersionDiffScalarSnapshot & {
  id: string;
  versionNumber: number;
  workflowStatus: string;
  createdAt: Date;
  isCurrentDraft: boolean;
  isPublishedVersion: boolean;
  isScheduledVersion: boolean;
  body: unknown;
  categories: ContentVersionDiffCategoryInput[];
  tags: ContentVersionDiffTagInput[];
  entities: ContentVersionDiffEntityInput[];
  media: ContentVersionDiffMediaInput[];
  authors: ContentVersionDiffAuthorInput[];
};

export type DiffContentVersionsInput = {
  contentItemId: string;
  from: ContentVersionDiffSideInput;
  to: ContentVersionDiffSideInput;
};
