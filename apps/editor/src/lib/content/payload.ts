import {
  AUTHOR_ROLES,
  ENTITY_ROLES,
  MEDIA_ROLES,
  PUBLISHING_ERROR,
  PublishingError,
  assertDraftRelationInputs,
  assertOptionalHttpUrl,
  assertSelectedCreatePrimaryCategory,
  assertStructuredArticleBody,
  canonicalizeContentSlug,
  canonicalizeDraftTitle,
  canonicalizeOptionalReviewNote,
  canonicalizeRequiredReviewNote,
  canonicalizeHeroAltText,
  canonicalizeHeroCredit,
  canonicalizeDraftGalleryItems,
  isUuid,
  optionalTrimmedText,
  parseCredibility,
  type Credibility,
  type EditorStaffScope,
  type PublishingDecision,
} from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "./http";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return value;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return value;
}

function requiredUuid(record: Record<string, unknown>, key: string): string {
  const value = requiredString(record, key);
  if (!isUuid(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return value;
}

function optionalUuid(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value !== "string" || !isUuid(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return value;
}

function requiredBoolean(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = record[key];
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "boolean") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return value;
}

function requiredArray(
  record: Record<string, unknown>,
  key: string,
): unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return value;
}

function optionalNonNegativeInt(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new PublishingError(PUBLISHING_ERROR.INVALID_RELATION);
  }

  return value;
}

function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }

  throw new PublishingError(PUBLISHING_ERROR.INVALID_RELATION);
}

export type ParsedCreateContent = {
  title: string;
  slug: string;
  subtitle: string | null;
  excerpt: string | null;
  body: Record<string, unknown> | unknown[];
  primaryCategoryId: string | null;
};

export function parseCreateContentBody(
  body: unknown,
  scope: EditorStaffScope,
): ParsedCreateContent {
  const record = asRecord(body);
  const title = unwrap(canonicalizeDraftTitle(requiredString(record, "title")));
  const slug = unwrap(canonicalizeContentSlug(requiredString(record, "slug")));
  const rawBody = record.body === undefined ? {} : record.body;
  const parsedBody = unwrap(assertStructuredArticleBody(rawBody));
  const primaryCategoryId = optionalUuid(record, "primaryCategoryId") ?? null;

  unwrap(
    assertSelectedCreatePrimaryCategory({
      ...scope,
      primaryCategoryId,
    }),
  );

  return {
    title,
    slug,
    subtitle: optionalTrimmedText(optionalString(record, "subtitle")),
    excerpt: optionalTrimmedText(optionalString(record, "excerpt")),
    body: parsedBody,
    primaryCategoryId,
  };
}

export type ParsedDraftSave = {
  versionId: string;
  expectedUpdatedAt: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  body: Record<string, unknown> | unknown[];
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  credibility: Credibility | null;
  credibilitySource: string | null;
  source: string | null;
  sourceOrganization: string | null;
  sourceUrl: string | null;
  syndicated: boolean;
  isMaterialUpdate: boolean;
  categories: { categoryId: string; isPrimary: boolean }[];
  tags: { tagId: string }[];
  entities: {
    entityId: string;
    role: (typeof ENTITY_ROLES)[number];
    sortOrder?: number;
  }[];
  media: {
    mediaId: string;
    role: (typeof MEDIA_ROLES)[number];
    sortOrder?: number;
    caption: string | null;
    altText: string | null;
    credit: string | null;
  }[];
  authors: {
    authorId: string;
    role: (typeof AUTHOR_ROLES)[number];
    sortOrder?: number;
  }[];
};

export type ParsedArticleEditorSave = {
  versionId: string;
  expectedUpdatedAt: string;
  body: Record<string, unknown> | unknown[];
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  credibility: Credibility | null;
  credibilitySource: string | null;
  source: string | null;
  sourceOrganization: string | null;
  sourceUrl: string | null;
  syndicated: boolean;
  isMaterialUpdate: boolean;
  categories: { categoryId: string; isPrimary: boolean }[];
  tags: { tagId: string }[];
  entities: {
    entityId: string;
    role: (typeof ENTITY_ROLES)[number];
    sortOrder?: number;
  }[];
  media: {
    mediaId: string;
    role: (typeof MEDIA_ROLES)[number];
    sortOrder?: number;
    caption: string | null;
    altText: string | null;
    credit: string | null;
  }[];
  authors: {
    authorId: string;
    role: (typeof AUTHOR_ROLES)[number];
    sortOrder?: number;
  }[];
};

function parseVersionRelations(record: Record<string, unknown>) {
  const categories = requiredArray(record, "categories").map((item) => {
    const row = asRecord(item);
    return {
      categoryId: requiredUuid(row, "categoryId"),
      isPrimary: requiredBoolean(row, "isPrimary", false),
    };
  });
  const tags = requiredArray(record, "tags").map((item) => {
    const row = asRecord(item);
    return { tagId: requiredUuid(row, "tagId") };
  });
  const entities = requiredArray(record, "entities").map((item) => {
    const row = asRecord(item);
    return {
      entityId: requiredUuid(row, "entityId"),
      role: requireEnum(row.role, ENTITY_ROLES),
      sortOrder: optionalNonNegativeInt(row.sortOrder),
    };
  });
  const media = requiredArray(record, "media").map((item) => {
    const row = asRecord(item);
    return {
      mediaId: requiredUuid(row, "mediaId"),
      role: requireEnum(row.role, MEDIA_ROLES),
      sortOrder: optionalNonNegativeInt(row.sortOrder),
      caption: optionalString(row, "caption"),
      altText: optionalString(row, "altText"),
      credit: optionalString(row, "credit"),
    };
  });
  const authors = requiredArray(record, "authors").map((item) => {
    const row = asRecord(item);
    return {
      authorId: requiredUuid(row, "authorId"),
      role: requireEnum(row.role, AUTHOR_ROLES),
      sortOrder: optionalNonNegativeInt(row.sortOrder),
    };
  });

  unwrap(
    assertDraftRelationInputs({
      categories,
      tags,
      entities,
      media,
      authors,
    }),
  );

  return { categories, tags, entities, media, authors };
}

export function parseArticleEditorSaveBody(
  body: unknown,
): ParsedArticleEditorSave {
  const record = asRecord(body);
  const title = unwrap(canonicalizeDraftTitle(requiredString(record, "title")));
  const canonicalUrl = unwrap(
    assertOptionalHttpUrl(optionalTrimmedText(optionalString(record, "canonicalUrl"))),
  );
  const sourceUrl = unwrap(
    assertOptionalHttpUrl(optionalTrimmedText(optionalString(record, "sourceUrl"))),
  );
  const parsedBody = unwrap(assertStructuredArticleBody(record.body));
  const relations = parseVersionRelations(record);

  return {
    versionId: requiredUuid(record, "versionId"),
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
    body: parsedBody,
    title,
    subtitle: optionalTrimmedText(optionalString(record, "subtitle")),
    excerpt: optionalTrimmedText(optionalString(record, "excerpt")),
    seoTitle: optionalTrimmedText(optionalString(record, "seoTitle")),
    seoDescription: optionalTrimmedText(optionalString(record, "seoDescription")),
    canonicalUrl,
    robots: optionalTrimmedText(optionalString(record, "robots")),
    credibility: unwrap(parseCredibility(record.credibility)),
    credibilitySource: optionalTrimmedText(
      optionalString(record, "credibilitySource"),
    ),
    source: optionalTrimmedText(optionalString(record, "source")),
    sourceOrganization: optionalTrimmedText(
      optionalString(record, "sourceOrganization"),
    ),
    sourceUrl,
    syndicated: requiredBoolean(record, "syndicated", false),
    isMaterialUpdate: requiredBoolean(record, "isMaterialUpdate", false),
    ...relations,
  };
}

export function parseDraftSaveBody(body: unknown): ParsedDraftSave {
  const record = asRecord(body);
  const title = unwrap(canonicalizeDraftTitle(requiredString(record, "title")));
  const parsedBody = unwrap(assertStructuredArticleBody(record.body));
  const canonicalUrl = unwrap(
    assertOptionalHttpUrl(optionalTrimmedText(optionalString(record, "canonicalUrl"))),
  );
  const sourceUrl = unwrap(
    assertOptionalHttpUrl(optionalTrimmedText(optionalString(record, "sourceUrl"))),
  );
  const credibility = unwrap(parseCredibility(record.credibility));
  const relations = parseVersionRelations(record);

  const expectedUpdatedAt = requiredString(record, "expectedUpdatedAt");
  if (Number.isNaN(new Date(expectedUpdatedAt).getTime())) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return {
    versionId: requiredUuid(record, "versionId"),
    expectedUpdatedAt,
    title,
    subtitle: optionalTrimmedText(optionalString(record, "subtitle")),
    excerpt: optionalTrimmedText(optionalString(record, "excerpt")),
    body: parsedBody,
    seoTitle: optionalTrimmedText(optionalString(record, "seoTitle")),
    seoDescription: optionalTrimmedText(optionalString(record, "seoDescription")),
    canonicalUrl,
    robots: optionalTrimmedText(optionalString(record, "robots")),
    credibility,
    credibilitySource: optionalTrimmedText(
      optionalString(record, "credibilitySource"),
    ),
    source: optionalTrimmedText(optionalString(record, "source")),
    sourceOrganization: optionalTrimmedText(
      optionalString(record, "sourceOrganization"),
    ),
    sourceUrl,
    syndicated: requiredBoolean(record, "syndicated", false),
    isMaterialUpdate: requiredBoolean(record, "isMaterialUpdate", false),
    ...relations,
  };
}

export function parseVersionIdBody(body: unknown): { versionId: string } {
  return { versionId: requiredUuid(asRecord(body), "versionId") };
}

export function parseSubmitReviewBody(body: unknown): {
  versionId: string;
  expectedUpdatedAt: string;
} {
  const record = asRecord(body);
  return {
    versionId: requiredUuid(record, "versionId"),
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
  };
}

export function parseApproveReviewBody(body: unknown): {
  versionId: string;
  expectedUpdatedAt: string;
  note: string | null;
} {
  const record = asRecord(body);
  return {
    versionId: requiredUuid(record, "versionId"),
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
    note: unwrap(canonicalizeOptionalReviewNote(optionalString(record, "note"))),
  };
}

export function parseRequestChangesBody(body: unknown): {
  versionId: string;
  expectedUpdatedAt: string;
  note: string;
} {
  const record = asRecord(body);
  return {
    versionId: requiredUuid(record, "versionId"),
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
    note: unwrap(canonicalizeRequiredReviewNote(optionalString(record, "note"))),
  };
}

export function parseRevisionBody(body: unknown): {
  sourceVersionId?: string;
} {
  return { sourceVersionId: optionalUuid(asRecord(body), "sourceVersionId") };
}

export function parseDraftHeroBody(body: unknown): {
  versionId: string;
  expectedUpdatedAt: string;
  mediaId: string | null;
  altText: string | null;
  credit: string | null;
} {
  const record = asRecord(body);
  const mediaIdValue = record.mediaId;
  let mediaId: string | null;
  if (mediaIdValue === null) {
    mediaId = null;
  } else if (typeof mediaIdValue === "string" && isUuid(mediaIdValue)) {
    mediaId = mediaIdValue;
  } else {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return {
    versionId: requiredUuid(record, "versionId"),
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
    mediaId,
    altText: unwrap(canonicalizeHeroAltText(optionalString(record, "altText"))),
    credit: unwrap(canonicalizeHeroCredit(optionalString(record, "credit"))),
  };
}

export function parseDraftGalleryBody(body: unknown): {
  versionId: string;
  expectedUpdatedAt: string;
  items: {
    mediaId: string;
    altText: string | null;
    credit: string | null;
    caption: string | null;
  }[];
} {
  const record = asRecord(body);
  const rawItems = requiredArray(record, "items");
  const items = rawItems.map((raw) => {
    const item = asRecord(raw);
    return {
      mediaId: requiredUuid(item, "mediaId"),
      altText: optionalString(item, "altText"),
      credit: optionalString(item, "credit"),
      caption: optionalString(item, "caption"),
    };
  });
  unwrap(canonicalizeDraftGalleryItems(items));
  return {
    versionId: requiredUuid(record, "versionId"),
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
    items,
  };
}

export function parseScheduleBody(body: unknown): {
  versionId: string;
  scheduledAt: Date;
} {
  const record = asRecord(body);
  return {
    versionId: requiredUuid(record, "versionId"),
    scheduledAt: parseScheduledAt(record.scheduledAt),
  };
}

export function parseRescheduleBody(body: unknown): { scheduledAt: Date } {
  return { scheduledAt: parseScheduledAt(asRecord(body).scheduledAt) };
}

function parseScheduledAt(value: unknown): Date {
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return date;
}

function requiredExpectedUpdatedAt(record: Record<string, unknown>): string {
  const expectedUpdatedAt = requiredString(record, "expectedUpdatedAt");
  if (Number.isNaN(new Date(expectedUpdatedAt).getTime())) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return expectedUpdatedAt;
}

export type ParsedContentSlugBody = {
  slug: string;
  expectedUpdatedAt: string;
};

export function parseContentSlugBody(body: unknown): ParsedContentSlugBody {
  const record = asRecord(body);
  const slug = unwrap(canonicalizeContentSlug(requiredString(record, "slug")));
  return {
    slug,
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
  };
}

function unwrap<T>(decision: PublishingDecision<T>): T {
  if (!decision.ok) {
    throw new PublishingError(decision.code);
  }

  return decision.value;
}
