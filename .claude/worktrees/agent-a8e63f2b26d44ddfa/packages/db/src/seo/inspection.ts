import {
  and,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  MEDIA_ROLE,
  MEDIA_TYPE,
  MEDIA_RENDITION_SURFACE,
  PUBLICATION_STATUS,
  PUBLIC_INDEXABILITY_REASON,
  SEO_FINDING_CODE,
  SEO_FINDING_FILTER,
  SEO_INSPECTION_ERROR,
  SEO_LEGAL_WITHDRAWAL_FILTER,
  SEO_ROBOTS_DIRECTIVE,
  SeoInspectionError,
  authorizeSeoInspection,
  clampSeoInspectionLimit,
  encodeEditorListCursor,
  evaluateMediaPublicEligibility,
  evaluateSeoHealth,
  evaluateDiscoverReadiness,
  inspectHeroRenditionSuitability,
  isMissingPublicMetaDescription,
  matchesDiscoverReadinessFilter,
  matchesSeoFindingFilter,
  parseSeoRobotsOverride,
  publicArticleCanonicalUrl,
  resolvePublicArticleCanonical,
  resolvePublicPublisherIdentity,
  resolvePublicWithdrawalKind,
  scopedCategoryIdsForQuery,
  seoInspectionGovernance,
  seoInspectionLeaksSensitiveMaterial,
  seoInspectionSummaryMeasurements,
  type EditorStaffScope,
  type MediaRightsRecord,
  type PublicPublisherIdentity,
  type PublicPublisherIdentityInput,
  type SeoInspectionDetail,
  type SeoInspectionFilters,
  type SeoInspectionHeroProjection,
  type SeoInspectionListItem,
  type SeoInspectionListResult,
  type SeoInspectionSummary,
  type SeoSlugHistoryEntry,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  loadMediaRenditionsByMediaIds,
  resolvePublicImageDelivery,
} from "../media/image-delivery";
import {
  contentItems,
  contentVersionCategories,
  contentVersionMedia,
  contentVersions,
} from "../schema/content";
import { media } from "../schema/media";
import { categories } from "../schema/taxonomy";
import { contentSlugHistory } from "../schema/slug-history";
import { staffUsers } from "../schema/staff";
import { resolvePublicMediaUrl } from "../public/resolve-public-media-url";
import { loadVersionAuthorSummaries } from "../editor/summaries";

const inspectionVersion = alias(contentVersions, "seo_inspection_version");
const inspectionPrimary = alias(
  contentVersionCategories,
  "seo_inspection_primary",
);
const primaryCategory = alias(categories, "seo_inspection_primary_category");
const heroRelation = alias(contentVersionMedia, "seo_inspection_hero");
const heroMedia = alias(media, "seo_inspection_hero_media");

const FINDING_FILTER_SCAN_PAGES = 20;

const inspectionVersionIdSql = sql`case
  when ${contentItems.deletedAt} is null
   and ${contentItems.retractedAt} is null
   and ${contentItems.takedownAt} is null
   and ${contentItems.publicationStatus} = ${PUBLICATION_STATUS.PUBLISHED}
   and ${contentItems.publishedVersionId} is not null
  then ${contentItems.publishedVersionId}
  else coalesce(
    ${contentItems.draftVersionId},
    ${contentItems.scheduledVersionId},
    ${contentItems.publishedVersionId}
  )
end`;

export type ListSeoInspectionsInput = {
  scope: EditorStaffScope;
  filters: SeoInspectionFilters;
  trustedSiteUrl: string;
  editorOrigin?: string | null;
  mediaPublicBaseUrl?: string;
  publisherName?: string | null;
  publisherUrl?: string | null;
  publisherLogoUrl?: string | null;
  publisher?: PublicPublisherIdentity | PublicPublisherIdentityInput | null;
  now?: Date;
};

export type SummarizeSeoInspectionsInput = {
  scope: EditorStaffScope;
  categoryId?: string;
};

export type GetSeoInspectionDetailInput = Omit<
  ListSeoInspectionsInput,
  "filters"
> & {
  contentItemId: string;
};

function resolvedInspectionPublisher(
  input: ListSeoInspectionsInput,
): PublicPublisherIdentity | null {
  if (input.publisher && "name" in input.publisher && input.publisher.name) {
    return resolvePublicPublisherIdentity(input.publisher);
  }
  return resolvePublicPublisherIdentity({
    name: input.publisherName,
    url: input.publisherUrl,
    logoUrl: input.publisherLogoUrl,
  });
}

function unwrapAuth(scope: EditorStaffScope): void {
  const decision = authorizeSeoInspection({ roles: scope.roles });
  if (!decision.ok) {
    throw new SeoInspectionError(decision.code);
  }
}

function indexableSql(): SQL {
  return and(
    isNull(contentItems.deletedAt),
    isNull(contentItems.retractedAt),
    isNull(contentItems.takedownAt),
    eq(contentItems.publicationStatus, PUBLICATION_STATUS.PUBLISHED),
    isNotNull(contentItems.publishedVersionId),
    isNotNull(contentItems.publishedAt),
    sql`not (
      coalesce(${inspectionVersion.robots}, '') ~* '(^|[[:space:],;])(noindex|none)([[:space:],;]|$)'
    )`,
  ) as SQL;
}

function notIndexableSql(): SQL {
  return sql`(
    ${contentItems.retractedAt} is not null
    or ${contentItems.takedownAt} is not null
    or ${contentItems.publicationStatus} <> ${PUBLICATION_STATUS.PUBLISHED}
    or ${contentItems.publishedVersionId} is null
    or ${contentItems.publishedAt} is null
    or coalesce(${inspectionVersion.robots}, '') ~* '(^|[[:space:],;])(noindex|none)([[:space:],;]|$)'
  )`;
}

function missingMetaDescriptionSql(): SQL {
  return sql`coalesce(btrim(${inspectionVersion.seoDescription}), '') = ''
    and coalesce(btrim(${inspectionVersion.excerpt}), '') = ''
    and coalesce(btrim(${inspectionVersion.subtitle}), '') = ''`;
}

function missingHeroOrAltSql(): SQL {
  return sql`(
    ${heroRelation.mediaId} is null
    or coalesce(btrim(${heroRelation.altText}), '') = ''
  )`;
}

function errorFindingSql(): SQL {
  return sql`(
    coalesce(btrim(${inspectionVersion.title}), '') = ''
    or (
      ${contentItems.publicationStatus} = ${PUBLICATION_STATUS.PUBLISHED}
      and ${contentItems.retractedAt} is null
      and ${contentItems.takedownAt} is null
      and (
        ${inspectionPrimary.categoryId} is null
        or coalesce(jsonb_typeof(${inspectionVersion.body}->'blocks'), 'null') <> 'array'
        or jsonb_array_length(${inspectionVersion.body}->'blocks') = 0
      )
    )
    or coalesce(${inspectionVersion.canonicalUrl}, '') ~* '(^https?://[^/]+/(login|content|api)/)'
  )`;
}

function warningFindingSql(): SQL {
  return sql`(
    (
      coalesce(btrim(${inspectionVersion.seoDescription}), '') = ''
      and coalesce(btrim(${inspectionVersion.excerpt}), '') = ''
      and coalesce(btrim(${inspectionVersion.subtitle}), '') = ''
    )
    or ${heroRelation.mediaId} is null
    or coalesce(btrim(${heroRelation.altText}), '') = ''
  )`;
}

function buildConditions(
  scope: EditorStaffScope,
  filters: SeoInspectionFilters,
): SQL[] {
  const conditions: SQL[] = [isNull(contentItems.deletedAt)];
  const scopedCategoryIds = scopedCategoryIdsForQuery(scope);

  if (scopedCategoryIds !== null) {
    conditions.push(isNotNull(inspectionPrimary.categoryId));
    conditions.push(inArray(inspectionPrimary.categoryId, [...scopedCategoryIds]));
  }

  if (filters.contentItemId) {
    conditions.push(eq(contentItems.id, filters.contentItemId));
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const searchClause = or(
      ilike(contentItems.slug, pattern),
      ilike(inspectionVersion.title, pattern),
    );
    if (searchClause) {
      conditions.push(searchClause);
    }
  }

  if (filters.publicationStatus) {
    conditions.push(
      eq(contentItems.publicationStatus, filters.publicationStatus),
    );
  } else if (filters.notPublished) {
    conditions.push(
      ne(contentItems.publicationStatus, PUBLICATION_STATUS.PUBLISHED),
    );
  }

  if (filters.categoryId) {
    conditions.push(
      exists(
        getDb()
          .select({ one: sql`1` })
          .from(contentVersionCategories)
          .where(
            and(
              eq(
                contentVersionCategories.contentVersionId,
                inspectionVersion.id,
              ),
              eq(contentVersionCategories.categoryId, filters.categoryId),
            ),
          ),
      ),
    );
  }

  if (filters.indexable === true) {
    conditions.push(indexableSql());
  } else if (filters.indexable === false) {
    conditions.push(notIndexableSql());
  }

  if (filters.missingSeoTitle) {
    conditions.push(sql`coalesce(btrim(${inspectionVersion.seoTitle}), '') = ''`);
  }

  if (filters.missingMetaDescription) {
    conditions.push(missingMetaDescriptionSql());
  }

  if (filters.missingHero) {
    conditions.push(isNull(heroRelation.mediaId));
  }

  if (filters.missingHeroAlt) {
    conditions.push(isNotNull(heroRelation.mediaId));
    conditions.push(
      sql`coalesce(btrim(${heroRelation.altText}), '') = ''`,
    );
  }

  if (filters.legalWithdrawal === SEO_LEGAL_WITHDRAWAL_FILTER.ANY) {
    conditions.push(
      sql`(
        ${contentItems.retractedAt} is not null
        or ${contentItems.takedownAt} is not null
      )`,
    );
  } else if (filters.legalWithdrawal === SEO_LEGAL_WITHDRAWAL_FILTER.RETRACTION) {
    conditions.push(isNotNull(contentItems.retractedAt));
  } else if (filters.legalWithdrawal === SEO_LEGAL_WITHDRAWAL_FILTER.TAKEDOWN) {
    conditions.push(isNotNull(contentItems.takedownAt));
  }

  if (filters.findingFilter === SEO_FINDING_FILTER.ERRORS) {
    conditions.push(errorFindingSql());
  } else if (filters.findingFilter === SEO_FINDING_FILTER.WARNINGS) {
    conditions.push(warningFindingSql());
  } else if (filters.findingFilter === SEO_FINDING_FILTER.HEALTHY) {
    conditions.push(sql`not ${errorFindingSql()} and not ${warningFindingSql()}`);
  }

  if (filters.cursor) {
    const cursorUpdatedAt = new Date(filters.cursor.updatedAt);
    const cursorClause = or(
      lt(contentItems.updatedAt, cursorUpdatedAt),
      and(
        eq(contentItems.updatedAt, cursorUpdatedAt),
        lt(contentItems.id, filters.cursor.id),
      ),
    );
    if (cursorClause) {
      conditions.push(cursorClause);
    }
  }

  return conditions;
}

type InspectionRow = {
  id: string;
  slug: string;
  publicationStatus: (typeof PUBLICATION_STATUS)[keyof typeof PUBLICATION_STATUS];
  publishedVersionId: string | null;
  publishedAt: Date | null;
  publicDateModified: Date | null;
  updatedAt: Date;
  retractedAt: Date | null;
  takedownAt: Date | null;
  inspectionVersionId: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  storedCanonicalUrl: string | null;
  storedRobots: string | null;
  slugHistoryCount: number;
  body: unknown;
  primaryCategoryId: string | null;
  primaryCategoryName: string | null;
  primaryCategorySlug: string | null;
  heroMediaId: string | null;
  heroAltText: string | null;
  heroStorageKey: string | null;
  heroWidth: number | null;
  heroHeight: number | null;
  heroSourceKind: MediaRightsRecord["sourceKind"] | null;
  heroSourceName: string | null;
  heroCreatorName: string | null;
  heroRightsHolder: string | null;
  heroLicenseType: MediaRightsRecord["licenseType"] | null;
  heroLicenseReference: string | null;
  heroLicenseStartsAt: Date | null;
  heroLicenseExpiresAt: Date | null;
  heroCreditLine: string | null;
  heroUsageRestriction: MediaRightsRecord["usageRestriction"] | null;
  heroTerritoryRestriction: string | null;
};

async function queryInspectionRows(
  scope: EditorStaffScope,
  filters: SeoInspectionFilters,
  limit: number,
): Promise<{ rows: InspectionRow[]; hasMore: boolean }> {
  const db = getDb();
  const conditions = buildConditions(scope, filters);
  const rows = await db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      publishedAt: contentItems.publishedAt,
      publicDateModified: contentItems.publicDateModified,
      updatedAt: contentItems.updatedAt,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
      inspectionVersionId: inspectionVersion.id,
      title: inspectionVersion.title,
      subtitle: inspectionVersion.subtitle,
      excerpt: inspectionVersion.excerpt,
      seoTitle: inspectionVersion.seoTitle,
      seoDescription: inspectionVersion.seoDescription,
      storedCanonicalUrl: inspectionVersion.canonicalUrl,
      storedRobots: inspectionVersion.robots,
      slugHistoryCount: sql<number>`(
        select count(*)::int
        from content_slug_history
        where content_slug_history.content_item_id = ${contentItems.id}
      )`,
      body: inspectionVersion.body,
      primaryCategoryId: primaryCategory.id,
      primaryCategoryName: primaryCategory.name,
      primaryCategorySlug: primaryCategory.slug,
      heroMediaId: heroMedia.id,
      heroAltText: heroRelation.altText,
      heroStorageKey: heroMedia.storageKey,
      heroWidth: heroMedia.width,
      heroHeight: heroMedia.height,
      heroSourceKind: heroMedia.sourceKind,
      heroSourceName: heroMedia.sourceName,
      heroCreatorName: heroMedia.creatorName,
      heroRightsHolder: heroMedia.rightsHolder,
      heroLicenseType: heroMedia.licenseType,
      heroLicenseReference: heroMedia.licenseReference,
      heroLicenseStartsAt: heroMedia.licenseStartsAt,
      heroLicenseExpiresAt: heroMedia.licenseExpiresAt,
      heroCreditLine: heroMedia.creditLine,
      heroUsageRestriction: heroMedia.usageRestriction,
      heroTerritoryRestriction: heroMedia.territoryRestriction,
    })
    .from(contentItems)
    .innerJoin(inspectionVersion, sql`${inspectionVersion.id} = ${inspectionVersionIdSql}`)
    .leftJoin(
      inspectionPrimary,
      and(
        eq(inspectionPrimary.contentVersionId, inspectionVersion.id),
        eq(inspectionPrimary.isPrimary, true),
      ),
    )
    .leftJoin(primaryCategory, eq(primaryCategory.id, inspectionPrimary.categoryId))
    .leftJoin(
      heroRelation,
      and(
        eq(heroRelation.contentVersionId, inspectionVersion.id),
        eq(heroRelation.role, MEDIA_ROLE.HERO),
      ),
    )
    .leftJoin(
      heroMedia,
      and(
        eq(heroMedia.id, heroRelation.mediaId),
        eq(heroMedia.mediaType, MEDIA_TYPE.IMAGE),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(contentItems.updatedAt), desc(contentItems.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  return {
    rows: (hasMore ? rows.slice(0, limit) : rows) as InspectionRow[],
    hasMore,
  };
}

function toListItem(
  row: InspectionRow,
  input: ListSeoInspectionsInput,
  authors: string[],
  renditionVariants: string[],
  originalHeroUrl: string | null,
  selectedHeroUrl: string | null,
  publicHeroWidth: number | null,
  publicHeroHeight: number | null,
): {
  item: SeoInspectionListItem;
  health: ReturnType<typeof evaluateSeoHealth>;
  hero: SeoInspectionHeroProjection;
  discover: ReturnType<typeof evaluateDiscoverReadiness>;
} {
  const now = input.now ?? new Date();
  const heroAssigned = row.heroMediaId !== null;
  const rights =
    heroAssigned && row.heroSourceKind && row.heroLicenseType && row.heroUsageRestriction
      ? evaluateMediaPublicEligibility(
          {
            sourceKind: row.heroSourceKind,
            sourceName: row.heroSourceName,
            creatorName: row.heroCreatorName,
            rightsHolder: row.heroRightsHolder,
            licenseType: row.heroLicenseType,
            licenseReference: row.heroLicenseReference,
            licenseNote: null,
            licenseStartsAt: row.heroLicenseStartsAt,
            licenseExpiresAt: row.heroLicenseExpiresAt,
            creditLine: row.heroCreditLine,
            usageRestriction: row.heroUsageRestriction,
            territoryRestriction: row.heroTerritoryRestriction,
          },
          now,
        )
      : null;
  const rendition = inspectHeroRenditionSuitability({
    originalUrl: originalHeroUrl,
    selectedUrl: selectedHeroUrl,
    renditionVariants,
  });

  const health = evaluateSeoHealth({
    trustedSiteUrl: input.trustedSiteUrl,
    editorOrigin: input.editorOrigin,
    slug: row.slug,
    title: row.title,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    excerpt: row.excerpt,
    subtitle: row.subtitle,
    storedCanonicalUrl: row.storedCanonicalUrl,
    storedRobots: row.storedRobots,
    publicationStatus: row.publicationStatus,
    publishedVersionId: row.publishedVersionId,
    publishedAt: row.publishedAt,
    publicDateModified: row.publicDateModified,
    deletedAt: null,
    retractedAt: row.retractedAt,
    takedownAt: row.takedownAt,
    primaryCategoryName: row.primaryCategoryName,
    authors,
    hero: heroAssigned
      ? {
          assigned: true,
          publicUrl: selectedHeroUrl,
          altText: row.heroAltText,
          width: publicHeroWidth ?? row.heroWidth,
          height: publicHeroHeight ?? row.heroHeight,
          preferredRenditionAvailable: rendition.preferredRenditionAvailable,
          usedLegacyOriginalFallback: rendition.usedLegacyOriginalFallback,
          rightsEligible: rights?.eligible ?? null,
          rightsStatus: rights?.status ?? null,
          rightsReasons: rights?.reasons ?? [],
        }
      : null,
    body: row.body,
    publisherName: resolvedInspectionPublisher(input)?.name ?? null,
    hasSlugRedirectHistory: Number(row.slugHistoryCount) > 0,
  });

  const publisher = resolvedInspectionPublisher(input);
  const discover = evaluateDiscoverReadiness({
    trustedSiteUrl: input.trustedSiteUrl,
    indexability: health.indexability,
    publicTitle: health.publicTitle,
    publicDescription: health.publicDescription,
    canonical: { url: health.publicCanonicalUrl },
    publishedAt: row.publishedAt,
    authors,
    hero: heroAssigned
      ? {
          assigned: true,
          publicUrl: selectedHeroUrl,
          altText: row.heroAltText,
          width: publicHeroWidth ?? row.heroWidth,
          height: publicHeroHeight ?? row.heroHeight,
        }
      : null,
    structuredData: health.structuredData,
    publisher,
  });

  const item: SeoInspectionListItem = {
    contentItemId: row.id,
    title: health.publicTitle || row.title,
    slug: row.slug,
    publicationStatus: row.publicationStatus,
    indexability: health.indexability,
    findings: health.findings,
    findingCodes: health.findings.map((finding) => finding.code),
    errorCount: health.errorCount,
    warningCount: health.warningCount,
    infoCount: health.infoCount,
    hasErrors: health.hasErrors,
    score: health.score,
    lastModified: row.publicDateModified ?? row.updatedAt,
    publishedAt: row.publishedAt,
    publicDateModified: row.publicDateModified,
    primaryCategory:
      row.primaryCategoryId && row.primaryCategoryName && row.primaryCategorySlug
        ? {
            id: row.primaryCategoryId,
            name: row.primaryCategoryName,
            slug: row.primaryCategorySlug,
          }
        : null,
    legalWithdrawal:
      row.retractedAt != null || row.takedownAt != null
        ? {
            kind: resolvePublicWithdrawalKind({
              retractedAt: row.retractedAt,
              takedownAt: row.takedownAt,
            }),
          }
        : null,
    missingMetaDescription: isMissingPublicMetaDescription({
      seoDescription: row.seoDescription,
      excerpt: row.excerpt,
      subtitle: row.subtitle,
    }),
    missingHero: !heroAssigned,
    missingHeroAlt: heroAssigned && (row.heroAltText?.trim() ?? "").length === 0,
    discoverReadiness: discover.state,
  };

  const hero: SeoInspectionHeroProjection = {
    assigned: heroAssigned,
    publicUrl: heroAssigned ? selectedHeroUrl : null,
    altText: heroAssigned ? row.heroAltText : null,
    width: heroAssigned ? (publicHeroWidth ?? row.heroWidth) : null,
    height: heroAssigned ? (publicHeroHeight ?? row.heroHeight) : null,
    preferredRenditionAvailable: heroAssigned
      ? rendition.preferredRenditionAvailable
      : false,
    usedLegacyOriginalFallback: heroAssigned
      ? rendition.usedLegacyOriginalFallback
      : false,
    rightsInformational: health.findings.some(
      (finding) => finding.code === SEO_FINDING_CODE.HERO_RIGHTS_INFORMATIONAL,
    ),
  };

  if (seoInspectionLeaksSensitiveMaterial(item) || seoInspectionLeaksSensitiveMaterial(hero)) {
    throw new SeoInspectionError(
      SEO_INSPECTION_ERROR.FORBIDDEN,
      "SEO inspection projection must not include sensitive fields.",
    );
  }

  return { item, health, hero, discover };
}

async function hydrateInspectedRows(
  rows: InspectionRow[],
  input: ListSeoInspectionsInput,
) {
  const versionIds = rows.map((row) => row.inspectionVersionId);
  const mediaIds = rows
    .map((row) => row.heroMediaId)
    .filter((id): id is string => id !== null);
  const [authorsByVersion, renditionsByMediaId] = await Promise.all([
    loadVersionAuthorSummaries(versionIds),
    loadMediaRenditionsByMediaIds(mediaIds),
  ]);

  return rows.map((row) => {
    const stored = row.heroMediaId
      ? renditionsByMediaId.get(row.heroMediaId)
      : undefined;
    const originalUrl = row.heroStorageKey
      ? resolvePublicMediaUrl(input.mediaPublicBaseUrl, row.heroStorageKey)
      : null;
    const delivery =
      row.heroStorageKey
        ? resolvePublicImageDelivery({
            mediaPublicBaseUrl: input.mediaPublicBaseUrl,
            originalStorageKey: row.heroStorageKey,
            originalWidth: row.heroWidth,
            originalHeight: row.heroHeight,
            renditions: stored,
            surface: MEDIA_RENDITION_SURFACE.ARTICLE_HERO,
          })
        : null;
    const variants = (stored ?? []).map((rendition) => rendition.variant);
    return {
      row,
      ...toListItem(
        row,
        input,
        (authorsByVersion.get(row.inspectionVersionId) ?? []).map(
          (author) => author.displayName,
        ),
        variants,
        originalUrl,
        delivery?.url ?? null,
        delivery?.width ?? null,
        delivery?.height ?? null,
      ),
    };
  });
}

async function hydrateRows(
  rows: InspectionRow[],
  input: ListSeoInspectionsInput,
): Promise<SeoInspectionListItem[]> {
  const inspected = await hydrateInspectedRows(rows, input);
  return inspected.map((entry) => entry.item);
}

export async function listSeoInspections(
  input: ListSeoInspectionsInput,
): Promise<SeoInspectionListResult> {
  unwrapAuth(input.scope);
  const scopedCategoryIds = scopedCategoryIdsForQuery(input.scope);
  const governance = seoInspectionGovernance();
  if (scopedCategoryIds !== null && scopedCategoryIds.length === 0) {
    return { items: [], nextCursor: null, governance };
  }

  const limit = clampSeoInspectionLimit(input.filters.limit);
  const collected: SeoInspectionListItem[] = [];
  let cursor = input.filters.cursor ?? null;
  let nextCursor: string | null = null;
  const findingFilter = input.filters.findingFilter;
  const discoverFilter = input.filters.discoverReadiness;
  const maxPages = findingFilter || discoverFilter ? FINDING_FILTER_SCAN_PAGES : 1;

  for (let page = 0; page < maxPages; page += 1) {
    const { rows, hasMore } = await queryInspectionRows(
      input.scope,
      { ...input.filters, cursor, limit },
      limit,
    );
    if (rows.length === 0) {
      nextCursor = null;
      break;
    }

    const hydrated = await hydrateRows(rows, input);
    for (let index = 0; index < hydrated.length; index += 1) {
      const item = hydrated[index];
      const row = rows[index];
      if (!item || !row) {
        continue;
      }
      if (!matchesSeoFindingFilter(item, findingFilter)) {
        continue;
      }
      if (!matchesDiscoverReadinessFilter(item, discoverFilter)) {
        continue;
      }
      collected.push(item);
      if (collected.length === limit) {
        const moreInPage = index < rows.length - 1 || hasMore;
        nextCursor = moreInPage
          ? encodeEditorListCursor({ updatedAt: row.updatedAt, id: row.id })
          : null;
        return { items: collected, nextCursor, governance };
      }
    }

    const last = rows[rows.length - 1];
    cursor = last
      ? { updatedAt: last.updatedAt.toISOString(), id: last.id }
      : null;
    nextCursor = hasMore && last
      ? encodeEditorListCursor({ updatedAt: last.updatedAt, id: last.id })
      : null;
    if (!hasMore) {
      break;
    }
  }

  return { items: collected, nextCursor, governance };
}

const EMPTY_SUMMARY: SeoInspectionSummary = {
  accessibleCount: 0,
  errorCount: 0,
  warningCount: 0,
  missingMetaDescriptionCount: 0,
  missingHeroCount: 0,
  notIndexableCount: 0,
  healthyPublishedCount: 0,
  measurements: seoInspectionSummaryMeasurements(),
};

export async function summarizeSeoInspections(
  input: SummarizeSeoInspectionsInput,
): Promise<SeoInspectionSummary> {
  unwrapAuth(input.scope);
  const scopedCategoryIds = scopedCategoryIdsForQuery(input.scope);
  if (scopedCategoryIds !== null && scopedCategoryIds.length === 0) {
    return EMPTY_SUMMARY;
  }

  const filters: SeoInspectionFilters = {
    limit: 1,
    categoryId: input.categoryId,
  };
  const conditions = buildConditions(input.scope, filters);
  const db = getDb();
  const [row] = await db
    .select({
      accessibleCount: sql<number>`count(*)::int`,
      errorCount: sql<number>`count(*) filter (where ${errorFindingSql()})::int`,
      warningCount: sql<number>`count(*) filter (where ${warningFindingSql()})::int`,
      missingMetaDescriptionCount: sql<number>`count(*) filter (where ${missingMetaDescriptionSql()})::int`,
      missingHeroCount: sql<number>`count(*) filter (where ${missingHeroOrAltSql()})::int`,
      notIndexableCount: sql<number>`count(*) filter (where ${notIndexableSql()})::int`,
      healthyPublishedCount: sql<number>`count(*) filter (
        where ${indexableSql()}
          and not ${errorFindingSql()}
          and not ${warningFindingSql()}
      )::int`,
    })
    .from(contentItems)
    .innerJoin(inspectionVersion, sql`${inspectionVersion.id} = ${inspectionVersionIdSql}`)
    .leftJoin(
      inspectionPrimary,
      and(
        eq(inspectionPrimary.contentVersionId, inspectionVersion.id),
        eq(inspectionPrimary.isPrimary, true),
      ),
    )
    .leftJoin(primaryCategory, eq(primaryCategory.id, inspectionPrimary.categoryId))
    .leftJoin(
      heroRelation,
      and(
        eq(heroRelation.contentVersionId, inspectionVersion.id),
        eq(heroRelation.role, MEDIA_ROLE.HERO),
      ),
    )
    .leftJoin(
      heroMedia,
      and(
        eq(heroMedia.id, heroRelation.mediaId),
        eq(heroMedia.mediaType, MEDIA_TYPE.IMAGE),
      ),
    )
    .where(and(...conditions));

  return {
    accessibleCount: Number(row?.accessibleCount ?? 0),
    errorCount: Number(row?.errorCount ?? 0),
    warningCount: Number(row?.warningCount ?? 0),
    missingMetaDescriptionCount: Number(row?.missingMetaDescriptionCount ?? 0),
    missingHeroCount: Number(row?.missingHeroCount ?? 0),
    notIndexableCount: Number(row?.notIndexableCount ?? 0),
    healthyPublishedCount: Number(row?.healthyPublishedCount ?? 0),
    measurements: seoInspectionSummaryMeasurements(),
  };
}

function trustedDestinationUrl(trustedSiteUrl: string, slug: string): string | null {
  try {
    return publicArticleCanonicalUrl(trustedSiteUrl, slug);
  } catch {
    return null;
  }
}

async function loadSlugHistory(
  contentItemId: string,
  currentSlug: string,
  trustedSiteUrl: string,
): Promise<SeoSlugHistoryEntry[]> {
  const destinationUrl = trustedDestinationUrl(trustedSiteUrl, currentSlug);
  const destinationPath = `/${currentSlug}`;
  const rows = await getDb()
    .select({
      oldSlug: contentSlugHistory.oldSlug,
      createdAt: contentSlugHistory.createdAt,
      actorDisplayName: staffUsers.displayName,
    })
    .from(contentSlugHistory)
    .innerJoin(staffUsers, eq(staffUsers.id, contentSlugHistory.actorStaffUserId))
    .where(eq(contentSlugHistory.contentItemId, contentItemId))
    .orderBy(desc(contentSlugHistory.createdAt), desc(contentSlugHistory.id))
    .limit(100);

  return rows.map((row) => ({
    oldSlug: row.oldSlug,
    oldPath: `/${row.oldSlug}`,
    destinationSlug: currentSlug,
    destinationPath,
    destinationUrl,
    createdAt: row.createdAt,
    actorDisplayName: row.actorDisplayName,
  }));
}

export async function getSeoInspectionDetail(
  input: GetSeoInspectionDetailInput,
): Promise<SeoInspectionDetail> {
  unwrapAuth(input.scope);
  const scopedCategoryIds = scopedCategoryIdsForQuery(input.scope);
  if (scopedCategoryIds !== null && scopedCategoryIds.length === 0) {
    throw new SeoInspectionError(SEO_INSPECTION_ERROR.CONTENT_NOT_FOUND);
  }

  const { rows } = await queryInspectionRows(
    input.scope,
    { limit: 1, contentItemId: input.contentItemId },
    1,
  );
  const row = rows[0];
  if (!row) {
    throw new SeoInspectionError(SEO_INSPECTION_ERROR.CONTENT_NOT_FOUND);
  }

  const [inspected] = await hydrateInspectedRows(rows, {
    ...input,
    filters: { limit: 1, contentItemId: input.contentItemId },
  });
  if (!inspected) {
    throw new SeoInspectionError(SEO_INSPECTION_ERROR.CONTENT_NOT_FOUND);
  }

  const slugHistory = await loadSlugHistory(
    row.id,
    row.slug,
    input.trustedSiteUrl,
  );
  const robots = parseSeoRobotsOverride(row.storedRobots);
  const canonical = resolvePublicArticleCanonical({
    trustedSiteUrl: input.trustedSiteUrl,
    slug: row.slug,
    storedCanonicalUrl: row.storedCanonicalUrl,
    editorOrigin: input.editorOrigin,
  });
  const systemForcedNoindex =
    !inspected.item.indexability.indexable &&
    inspected.item.indexability.reason !==
      PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_ROBOTS_OVERRIDE;

  const detail: SeoInspectionDetail = {
    ...inspected.item,
    articleTitle: row.title,
    publicTitle: inspected.health.publicTitle,
    publicDescription: inspected.health.publicDescription,
    publicCanonicalUrl: inspected.health.publicCanonicalUrl,
    canonical: {
      resolvedUrl: canonical.url,
      generatedUrl: canonical.generatedUrl,
      appliedOverride: canonical.appliedOverride,
      storedValuePresent: (row.storedCanonicalUrl?.trim() ?? "").length > 0,
      rejection: canonical.rejection,
    },
    robots: {
      directive: robots.directive,
      unrecognized: robots.unrecognized,
      systemForcedNoindex,
      editorRestrictionActive:
        inspected.item.indexability.reason ===
          PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_ROBOTS_OVERRIDE ||
        (robots.directive === SEO_ROBOTS_DIRECTIVE.NOINDEX &&
          !systemForcedNoindex),
    },
    structuredData: {
      wouldEmit: inspected.health.structuredData.wouldEmit,
      complete: inspected.health.structuredData.complete,
      presentFields: inspected.health.structuredData.presentFields,
      missingRequiredFields: inspected.health.structuredData.missingRequiredFields,
      missingRecommendedFields:
        inspected.health.structuredData.missingRecommendedFields,
      publisherConfigured: inspected.health.structuredData.publisherConfigured,
    },
    hero: inspected.hero,
    slugHistory,
    inspectedVersionIsPublicAuthority:
      row.publicationStatus === PUBLICATION_STATUS.PUBLISHED &&
      row.publishedVersionId === row.inspectionVersionId &&
      row.retractedAt == null &&
      row.takedownAt == null,
    discover: inspected.discover,
  };

  if (seoInspectionLeaksSensitiveMaterial(detail)) {
    throw new SeoInspectionError(
      SEO_INSPECTION_ERROR.FORBIDDEN,
      "SEO inspection projection must not include sensitive fields.",
    );
  }

  return detail;
}

export async function listSeoSlugHistory(input: {
  scope: EditorStaffScope;
  contentItemId: string;
  trustedSiteUrl: string;
}): Promise<SeoSlugHistoryEntry[]> {
  unwrapAuth(input.scope);
  const scopedCategoryIds = scopedCategoryIdsForQuery(input.scope);
  if (scopedCategoryIds !== null && scopedCategoryIds.length === 0) {
    throw new SeoInspectionError(SEO_INSPECTION_ERROR.CONTENT_NOT_FOUND);
  }

  const { rows } = await queryInspectionRows(
    input.scope,
    { limit: 1, contentItemId: input.contentItemId },
    1,
  );
  const row = rows[0];
  if (!row) {
    throw new SeoInspectionError(SEO_INSPECTION_ERROR.CONTENT_NOT_FOUND);
  }

  return loadSlugHistory(row.id, row.slug, input.trustedSiteUrl);
}
