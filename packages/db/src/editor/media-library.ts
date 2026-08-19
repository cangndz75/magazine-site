import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  not,
  or,
  sql,
} from "drizzle-orm";
import {
  authorizeMediaRightsRead,
  CAPABILITY,
  canPerform,
  MEDIA_LICENSE_TYPE,
  MEDIA_RIGHTS_ERROR,
  MEDIA_RIGHTS_STATUS,
  MEDIA_SOURCE_KIND,
  MEDIA_USAGE_RESTRICTION,
  MEDIA_RENDITION_SURFACE,
  MediaRightsError,
  type MediaRightsStatus,
  type MediaType,
  type StaffRole,
  type StaffScopeMode,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentVersionCategories,
  contentVersionMedia,
  contentVersions,
} from "../schema/content";
import { media } from "../schema/media";
import { loadMediaRenditionsByMediaIds } from "../media/image-delivery";
import {
  eligibilityForRow,
  previewUrlForImageSurface,
  rightsFromMediaRow,
  type EditorMediaRightsFields,
} from "./media-projections";

export const EDITOR_MEDIA_SORT = {
  CREATED_DESC: "created_desc",
  CREATED_ASC: "created_asc",
  FILENAME_ASC: "filename_asc",
  FILENAME_DESC: "filename_desc",
  EXPIRES_ASC: "expires_asc",
} as const;

export type EditorMediaSort =
  (typeof EDITOR_MEDIA_SORT)[keyof typeof EDITOR_MEDIA_SORT];

export const EDITOR_MEDIA_SORTS = [
  EDITOR_MEDIA_SORT.CREATED_DESC,
  EDITOR_MEDIA_SORT.CREATED_ASC,
  EDITOR_MEDIA_SORT.FILENAME_ASC,
  EDITOR_MEDIA_SORT.FILENAME_DESC,
  EDITOR_MEDIA_SORT.EXPIRES_ASC,
] as const;

export const EDITOR_MEDIA_PAGE_SIZE_DEFAULT = 24;
export const EDITOR_MEDIA_PAGE_SIZE_MAX = 48;
export const EDITOR_MEDIA_SEARCH_MAX = 120;

export type EditorMediaListItem = {
  id: string;
  label: string;
  mediaType: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  previewUrl: string | null;
  creatorName: string | null;
  creditLine: string | null;
  eligibility: ReturnType<typeof eligibilityForRow>;
  usageCount: number;
  createdAt: Date;
};

export type EditorMediaListResult = {
  items: EditorMediaListItem[];
  nextCursor: string | null;
  totalCount: number;
  summary: {
    total: number;
    eligible: number;
    incomplete: number;
    restricted: number;
    expired: number;
  };
};

export type EditorMediaUsage = {
  contentItemId: string;
  contentVersionId: string;
  title: string;
  slug: string;
  role: string;
  publicationStatus: string;
  workflowStatus: string;
  versionNumber: number;
  altText: string | null;
  credit: string | null;
};

export type EditorMediaInspector = {
  id: string;
  label: string;
  mediaType: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  previewUrl: string | null;
  createdAt: Date;
  rights: EditorMediaRightsFields;
  eligibility: ReturnType<typeof eligibilityForRow>;
  usages: EditorMediaUsage[];
  usageCount: number;
};

type StaffAccess = {
  roles: readonly StaffRole[];
  scopeMode: StaffScopeMode;
  scopedCategoryIds: readonly string[];
};

function unwrapRead(roles: readonly StaffRole[]): void {
  const decision = authorizeMediaRightsRead({ roles });
  if (!decision.ok) {
    throw new MediaRightsError(decision.code);
  }
}

function displayLabel(row: {
  originalFilename: string | null;
  storageKey: string;
}): string {
  const original = row.originalFilename?.trim();
  if (original) {
    return original;
  }
  const segments = row.storageKey.split("/").filter((part) => part.length > 0);
  return segments.length > 0 ? segments[segments.length - 1] : row.storageKey;
}

function rightsStatusSqlFilter(
  status: MediaRightsStatus,
  now: Date,
): ReturnType<typeof and> | ReturnType<typeof or> | ReturnType<typeof eq> {
  const nowIso = now.toISOString();
  const incomplete = or(
    eq(media.sourceKind, MEDIA_SOURCE_KIND.UNKNOWN),
    eq(media.licenseType, MEDIA_LICENSE_TYPE.UNKNOWN),
    isNull(media.rightsHolder),
    isNull(media.creditLine),
  );
  const restricted = eq(
    media.usageRestriction,
    MEDIA_USAGE_RESTRICTION.RESTRICTED,
  );
  const expired = and(
    not(isNull(media.licenseExpiresAt)),
    lte(media.licenseExpiresAt, sql`${nowIso}::timestamptz`),
  );
  const notStarted = and(
    not(isNull(media.licenseStartsAt)),
    gt(media.licenseStartsAt, sql`${nowIso}::timestamptz`),
  );

  switch (status) {
    case MEDIA_RIGHTS_STATUS.INCOMPLETE:
      return incomplete!;
    case MEDIA_RIGHTS_STATUS.RESTRICTED:
      return restricted;
    case MEDIA_RIGHTS_STATUS.EXPIRED:
      return expired!;
    case MEDIA_RIGHTS_STATUS.NOT_STARTED:
      return notStarted!;
    case MEDIA_RIGHTS_STATUS.CLEARED:
      return and(
        not(eq(media.sourceKind, MEDIA_SOURCE_KIND.UNKNOWN)),
        not(eq(media.licenseType, MEDIA_LICENSE_TYPE.UNKNOWN)),
        not(isNull(media.rightsHolder)),
        not(isNull(media.creditLine)),
        not(eq(media.usageRestriction, MEDIA_USAGE_RESTRICTION.RESTRICTED)),
        or(
          isNull(media.licenseExpiresAt),
          gt(media.licenseExpiresAt, sql`${nowIso}::timestamptz`),
        ),
        or(
          isNull(media.licenseStartsAt),
          lte(media.licenseStartsAt, sql`${nowIso}::timestamptz`),
        ),
      )!;
    default:
      return eq(media.id, media.id);
  }
}

function parseSort(value: string | undefined): EditorMediaSort {
  if (
    value !== undefined &&
    (EDITOR_MEDIA_SORTS as readonly string[]).includes(value)
  ) {
    return value as EditorMediaSort;
  }
  return EDITOR_MEDIA_SORT.CREATED_DESC;
}

function parsePageSize(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return EDITOR_MEDIA_PAGE_SIZE_DEFAULT;
  }
  return Math.min(parsed, EDITOR_MEDIA_PAGE_SIZE_MAX);
}

function parseSearch(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > EDITOR_MEDIA_SEARCH_MAX) {
    return trimmed.slice(0, EDITOR_MEDIA_SEARCH_MAX);
  }
  return trimmed;
}

export function parseEditorMediaSort(value: string | undefined): EditorMediaSort {
  return parseSort(value);
}

export function parseEditorMediaPageSize(value: string | undefined): number {
  return parsePageSize(value);
}

export function parseEditorMediaSearch(value: string | undefined): string | null {
  return parseSearch(value);
}

type CursorPayload = {
  sort: EditorMediaSort;
  id: string;
  createdAt?: string;
  storageKey?: string;
  filename?: string;
  licenseExpiresAt?: string | null;
};

export function encodeMediaCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeMediaCursor(raw: string | undefined): CursorPayload | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as CursorPayload;
    if (!parsed.id || !parsed.sort) {
      return null;
    }
    if (!(EDITOR_MEDIA_SORTS as readonly string[]).includes(parsed.sort)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function searchFilter(term: string) {
  const sanitized = term.replace(/[%_]/g, "");
  if (sanitized.length === 0) {
    return undefined;
  }
  const pattern = `%${sanitized}%`;
  return or(
    ilike(media.storageKey, pattern),
    ilike(media.originalFilename, pattern),
    ilike(media.creatorName, pattern),
    ilike(media.rightsHolder, pattern),
    ilike(media.sourceName, pattern),
    ilike(media.creditLine, pattern),
  );
}

function usageCountSubquery() {
  return sql<number>`(
    SELECT COUNT(*)::int
    FROM ${contentVersionMedia}
    WHERE ${contentVersionMedia.mediaId} = ${media.id}
  )`;
}

function filenameSortExpression() {
  return sql`coalesce(${media.originalFilename}, ${media.storageKey})`;
}

function filenameSortValue(row: typeof media.$inferSelect): string {
  return row.originalFilename ?? row.storageKey;
}

function cursorCondition(
  sort: EditorMediaSort,
  cursor: CursorPayload,
): ReturnType<typeof and> | undefined {
  switch (sort) {
    case EDITOR_MEDIA_SORT.CREATED_DESC:
      if (!cursor.createdAt) {
        return undefined;
      }
      return or(
        lt(media.createdAt, sql`${cursor.createdAt}::timestamptz`),
        and(
          eq(media.createdAt, sql`${cursor.createdAt}::timestamptz`),
          lt(media.id, cursor.id),
        ),
      );
    case EDITOR_MEDIA_SORT.CREATED_ASC:
      if (!cursor.createdAt) {
        return undefined;
      }
      return or(
        gt(media.createdAt, sql`${cursor.createdAt}::timestamptz`),
        and(
          eq(media.createdAt, sql`${cursor.createdAt}::timestamptz`),
          gt(media.id, cursor.id),
        ),
      );
    case EDITOR_MEDIA_SORT.FILENAME_ASC: {
      const cursorFilename = cursor.filename ?? cursor.storageKey;
      if (!cursorFilename) {
        return undefined;
      }
      const expr = filenameSortExpression();
      return or(
        gt(expr, cursorFilename),
        and(eq(expr, cursorFilename), gt(media.id, cursor.id)),
      );
    }
    case EDITOR_MEDIA_SORT.FILENAME_DESC: {
      const cursorFilename = cursor.filename ?? cursor.storageKey;
      if (!cursorFilename) {
        return undefined;
      }
      const expr = filenameSortExpression();
      return or(
        lt(expr, cursorFilename),
        and(eq(expr, cursorFilename), lt(media.id, cursor.id)),
      );
    }
    case EDITOR_MEDIA_SORT.EXPIRES_ASC:
      if (cursor.licenseExpiresAt === undefined) {
        return undefined;
      }
      if (cursor.licenseExpiresAt === null) {
        return and(isNull(media.licenseExpiresAt), gt(media.id, cursor.id));
      }
      return or(
        gt(media.licenseExpiresAt, sql`${cursor.licenseExpiresAt}::timestamptz`),
        and(
          eq(media.licenseExpiresAt, sql`${cursor.licenseExpiresAt}::timestamptz`),
          gt(media.id, cursor.id),
        ),
        isNull(media.licenseExpiresAt),
      );
    default:
      return undefined;
  }
}

function orderByForSort(sort: EditorMediaSort) {
  switch (sort) {
    case EDITOR_MEDIA_SORT.CREATED_ASC:
      return [asc(media.createdAt), asc(media.id)];
    case EDITOR_MEDIA_SORT.FILENAME_ASC:
      return [asc(filenameSortExpression()), asc(media.id)];
    case EDITOR_MEDIA_SORT.FILENAME_DESC:
      return [desc(filenameSortExpression()), desc(media.id)];
    case EDITOR_MEDIA_SORT.EXPIRES_ASC:
      return [
        sql`${media.licenseExpiresAt} ASC NULLS LAST`,
        asc(media.id),
      ];
    default:
      return [desc(media.createdAt), desc(media.id)];
  }
}

function nextCursorForRow(
  sort: EditorMediaSort,
  row: typeof media.$inferSelect,
): string {
  return encodeMediaCursor({
    sort,
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    storageKey: row.storageKey,
    filename: filenameSortValue(row),
    licenseExpiresAt: row.licenseExpiresAt?.toISOString() ?? null,
  });
}

function canReadContentCategory(
  access: StaffAccess,
  categoryId: string | null,
): boolean {
  if (!categoryId) {
    return false;
  }
  return canPerform({
    roles: access.roles,
    capability: CAPABILITY.CONTENT_READ,
    scopeMode: access.scopeMode,
    scopedCategoryIds: access.scopedCategoryIds,
    categoryId,
  });
}

export async function listEditorMedia(input: {
  roles: readonly StaffRole[];
  mediaPublicBaseUrl: string | undefined;
  q?: string;
  mediaType?: MediaType;
  rightsStatus?: MediaRightsStatus;
  missingCredit?: boolean;
  missingAltText?: boolean;
  used?: boolean;
  unused?: boolean;
  sort?: string;
  cursor?: string;
  pageSize?: string;
  now?: Date;
}): Promise<EditorMediaListResult> {
  unwrapRead(input.roles);
  const now = input.now ?? new Date();
  const sort = parseSort(input.sort);
  const pageSize = parsePageSize(input.pageSize);
  const search = parseSearch(input.q);
  const cursor = decodeMediaCursor(input.cursor);
  const db = getDb();

  const filters: ReturnType<typeof and>[] = [];

  if (search) {
    const searchClause = searchFilter(search);
    if (searchClause) {
      filters.push(searchClause);
    }
  }
  if (input.mediaType) {
    filters.push(eq(media.mediaType, input.mediaType));
  }
  if (input.rightsStatus) {
    filters.push(rightsStatusSqlFilter(input.rightsStatus, now));
  }
  if (input.missingCredit) {
    filters.push(isNull(media.creditLine));
  }
  if (input.missingAltText) {
    const altMissing = db
      .select({ mediaId: contentVersionMedia.mediaId })
      .from(contentVersionMedia)
      .where(
        or(
          isNull(contentVersionMedia.altText),
          eq(contentVersionMedia.altText, ""),
        ),
      );
    filters.push(inArray(media.id, altMissing));
  }
  if (input.used) {
    const usedIds = db
      .select({ mediaId: contentVersionMedia.mediaId })
      .from(contentVersionMedia);
    filters.push(inArray(media.id, usedIds));
  }
  if (input.unused) {
    const usedIds = db
      .select({ mediaId: contentVersionMedia.mediaId })
      .from(contentVersionMedia);
    filters.push(not(inArray(media.id, usedIds)));
  }
  if (cursor && cursor.sort === sort) {
    const cursorFilter = cursorCondition(sort, cursor);
    if (cursorFilter) {
      filters.push(cursorFilter);
    }
  }

  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  const [countRow] = await db
    .select({ total: count() })
    .from(media)
    .where(whereClause);

  const rows = await db
    .select({
      row: media,
      usageCount: usageCountSubquery(),
    })
    .from(media)
    .where(whereClause)
    .orderBy(...orderByForSort(sort))
    .limit(pageSize + 1);

  const pageRows = rows.slice(0, pageSize);
  const hasMore = rows.length > pageSize;
  const renditionsByMediaId = await loadMediaRenditionsByMediaIds(
    pageRows.map(({ row }) => row.id),
  );

  const items: EditorMediaListItem[] = pageRows.map(({ row, usageCount }) => ({
    id: row.id,
    label: displayLabel(row),
    mediaType: row.mediaType,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    previewUrl: previewUrlForImageSurface({
      mediaPublicBaseUrl: input.mediaPublicBaseUrl,
      originalStorageKey: row.storageKey,
      originalWidth: row.width,
      originalHeight: row.height,
      renditions: renditionsByMediaId.get(row.id),
      surface: MEDIA_RENDITION_SURFACE.LIBRARY_CARD,
    }),
    creatorName: row.creatorName,
    creditLine: row.creditLine,
    eligibility: eligibilityForRow(row, now),
    usageCount: Number(usageCount ?? 0),
    createdAt: row.createdAt,
  }));

  let eligible = 0;
  let incomplete = 0;
  let restricted = 0;
  let expired = 0;
  for (const item of items) {
    if (item.eligibility.eligible) {
      eligible += 1;
    }
    switch (item.eligibility.status) {
      case MEDIA_RIGHTS_STATUS.INCOMPLETE:
        incomplete += 1;
        break;
      case MEDIA_RIGHTS_STATUS.RESTRICTED:
        restricted += 1;
        break;
      case MEDIA_RIGHTS_STATUS.EXPIRED:
        expired += 1;
        break;
      default:
        break;
    }
  }

  return {
    items,
    nextCursor:
      hasMore && pageRows.length > 0
        ? nextCursorForRow(sort, pageRows[pageRows.length - 1].row)
        : null,
    totalCount: Number(countRow?.total ?? 0),
    summary: {
      total: Number(countRow?.total ?? 0),
      eligible,
      incomplete,
      restricted,
      expired,
    },
  };
}

export async function getEditorMediaInspector(input: {
  mediaId: string;
  roles: readonly StaffRole[];
  scopeMode: StaffScopeMode;
  scopedCategoryIds: readonly string[];
  mediaPublicBaseUrl: string | undefined;
  now?: Date;
}): Promise<EditorMediaInspector> {
  unwrapRead(input.roles);
  const now = input.now ?? new Date();
  const db = getDb();

  const [row] = await db
    .select()
    .from(media)
    .where(eq(media.id, input.mediaId))
    .limit(1);

  if (!row) {
    throw new MediaRightsError(MEDIA_RIGHTS_ERROR.MEDIA_NOT_FOUND);
  }

  const usageRows = await db
    .select({
      contentItemId: contentItems.id,
      contentVersionId: contentVersions.id,
      title: contentVersions.title,
      slug: contentItems.slug,
      role: contentVersionMedia.role,
      publicationStatus: contentItems.publicationStatus,
      workflowStatus: contentVersions.workflowStatus,
      versionNumber: contentVersions.versionNumber,
      altText: contentVersionMedia.altText,
      credit: contentVersionMedia.credit,
      primaryCategoryId: contentVersionCategories.categoryId,
    })
    .from(contentVersionMedia)
    .innerJoin(
      contentVersions,
      eq(contentVersionMedia.contentVersionId, contentVersions.id),
    )
    .innerJoin(contentItems, eq(contentVersions.contentItemId, contentItems.id))
    .leftJoin(
      contentVersionCategories,
      and(
        eq(contentVersionCategories.contentVersionId, contentVersions.id),
        eq(contentVersionCategories.isPrimary, true),
      ),
    )
    .where(eq(contentVersionMedia.mediaId, input.mediaId))
    .orderBy(desc(contentVersions.createdAt));

  const access: StaffAccess = {
    roles: input.roles,
    scopeMode: input.scopeMode,
    scopedCategoryIds: input.scopedCategoryIds,
  };

  const usages: EditorMediaUsage[] = [];
  for (const usage of usageRows) {
    if (!canReadContentCategory(access, usage.primaryCategoryId)) {
      continue;
    }
    usages.push({
      contentItemId: usage.contentItemId,
      contentVersionId: usage.contentVersionId,
      title: usage.title,
      slug: usage.slug,
      role: usage.role,
      publicationStatus: usage.publicationStatus,
      workflowStatus: usage.workflowStatus,
      versionNumber: usage.versionNumber,
      altText: usage.altText,
      credit: usage.credit,
    });
  }

  const renditionsByMediaId = await loadMediaRenditionsByMediaIds([row.id]);

  return {
    id: row.id,
    label: displayLabel(row),
    mediaType: row.mediaType,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    byteSize: row.byteSize,
    previewUrl: previewUrlForImageSurface({
      mediaPublicBaseUrl: input.mediaPublicBaseUrl,
      originalStorageKey: row.storageKey,
      originalWidth: row.width,
      originalHeight: row.height,
      renditions: renditionsByMediaId.get(row.id),
      surface: MEDIA_RENDITION_SURFACE.LIBRARY_INSPECTOR,
    }),
    createdAt: row.createdAt,
    rights: rightsFromMediaRow(row),
    eligibility: eligibilityForRow(row, now),
    usages,
    usageCount: usages.length,
  };
}
