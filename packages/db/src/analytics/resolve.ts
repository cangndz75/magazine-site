import { and, asc, eq } from "drizzle-orm";
import {
  ANALYTICS_ERROR,
  ANALYTICS_EVENT_NAME,
  ANALYTICS_HOMEPAGE_SLOT_PLACEMENTS,
  ANALYTICS_PLACEMENT,
  CONTENT_LEGAL_ACTION_TYPE,
  MEDIA_ROLE,
  PUBLICATION_STATUS,
  classifyPublicContentAnalytics,
  toPublicLegalNotice,
  type AnalyticsContextClaims,
  type AnalyticsDecision,
  type AnalyticsEnrichmentSnapshot,
  type AnalyticsWireEvent,
  type HomepageSlotKey,
  type PublicLegalNoticeKind,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  contentItems,
  contentLegalActions,
  contentVersionAuthors,
  contentVersionCategories,
  contentVersionMedia,
  contentVersions,
} from "../schema/content";
import {
  homepageSlots,
  homepageVersionVideos,
  homepageVersions,
} from "../schema/homepage-builder";
import { contentVersionVideos, editorialVideoAssets } from "../schema/video";

type ContentRow = {
  id: string;
  slug: string;
  publicationStatus: "NEVER_PUBLISHED" | "PUBLISHED" | "UNPUBLISHED";
  publishedVersionId: string | null;
  deletedAt: Date | null;
  retractedAt: Date | null;
  takedownAt: Date | null;
};

async function loadContent(contentItemId: string): Promise<ContentRow | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: contentItems.id,
      slug: contentItems.slug,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      deletedAt: contentItems.deletedAt,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
    })
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId))
    .limit(1);
  return row ?? null;
}

async function loadArticleSnapshotForVersion(
  contentItemId: string,
  publishedVersionId: string,
): Promise<
  AnalyticsDecision<Extract<AnalyticsEnrichmentSnapshot, { type: "ARTICLE_LIVE" }>>
> {
  const row = await loadContent(contentItemId);
  if (!row || row.deletedAt) {
    return { ok: false, code: ANALYTICS_ERROR.NOT_PUBLIC };
  }
  if (row.publicationStatus !== PUBLICATION_STATUS.PUBLISHED) {
    return { ok: false, code: ANALYTICS_ERROR.NOT_PUBLIC };
  }
  if (row.retractedAt != null || row.takedownAt != null) {
    return { ok: false, code: ANALYTICS_ERROR.NOT_PUBLIC };
  }

  const db = getDb();
  const [version] = await db
    .select({ id: contentVersions.id })
    .from(contentVersions)
    .where(
      and(
        eq(contentVersions.id, publishedVersionId),
        eq(contentVersions.contentItemId, contentItemId),
      ),
    )
    .limit(1);
  if (!version) {
    return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
  }

  const [categoryRow] = await db
    .select({ categoryId: contentVersionCategories.categoryId })
    .from(contentVersionCategories)
    .where(
      and(
        eq(contentVersionCategories.contentVersionId, publishedVersionId),
        eq(contentVersionCategories.isPrimary, true),
      ),
    )
    .limit(1);
  const authorRows = await db
    .select({ authorId: contentVersionAuthors.authorId })
    .from(contentVersionAuthors)
    .where(eq(contentVersionAuthors.contentVersionId, publishedVersionId))
    .orderBy(asc(contentVersionAuthors.sortOrder), asc(contentVersionAuthors.authorId));
  const legalRows = await db
    .select({
      actionType: contentLegalActions.actionType,
      publicNote: contentLegalActions.publicNote,
      effectiveAt: contentLegalActions.effectiveAt,
    })
    .from(contentLegalActions)
    .where(eq(contentLegalActions.contentItemId, contentItemId))
    .orderBy(asc(contentLegalActions.effectiveAt), asc(contentLegalActions.id));

  let publicLegalNoticeKind: PublicLegalNoticeKind | undefined;
  for (const legal of legalRows) {
    if (
      legal.actionType !== CONTENT_LEGAL_ACTION_TYPE.CORRECTION &&
      legal.actionType !== CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION
    ) {
      continue;
    }
    const notice = toPublicLegalNotice(legal);
    if (notice) {
      publicLegalNoticeKind = notice.kind;
    }
  }

  return {
    ok: true,
    value: {
      type: "ARTICLE_LIVE",
      contentItemId: row.id,
      publishedVersionId,
      publicSlug: row.slug,
      ...(categoryRow?.categoryId ? { primaryCategoryId: categoryRow.categoryId } : {}),
      ...(authorRows.length > 0
        ? { authorIds: authorRows.map((item) => item.authorId) }
        : {}),
      ...(publicLegalNoticeKind ? { publicLegalNoticeKind } : {}),
    },
  };
}

async function loadWithdrawnSnapshot(contentItemId: string): Promise<
  AnalyticsDecision<Extract<AnalyticsEnrichmentSnapshot, { type: "WITHDRAWN_SHELL" }>>
> {
  const row = await loadContent(contentItemId);
  if (!row) {
    return { ok: false, code: ANALYTICS_ERROR.NOT_PUBLIC };
  }
  const classification = classifyPublicContentAnalytics(row);
  if (classification.kind !== ANALYTICS_EVENT_NAME.PAGE_VIEW) {
    return { ok: false, code: ANALYTICS_ERROR.NOT_PUBLIC };
  }
  return {
    ok: true,
    value: {
      type: "WITHDRAWN_SHELL",
      contentItemId: row.id,
      publicSlug: row.slug,
      withdrawalKind: classification.withdrawalKind,
    },
  };
}

async function homepageVersionExists(homepageVersionId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: homepageVersions.id })
    .from(homepageVersions)
    .where(eq(homepageVersions.id, homepageVersionId))
    .limit(1);
  return Boolean(row);
}

async function loadHomepageSlotContent(
  homepageVersionId: string,
  slotKey: HomepageSlotKey,
): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ contentItemId: homepageSlots.contentItemId })
    .from(homepageSlots)
    .where(
      and(
        eq(homepageSlots.homepageVersionId, homepageVersionId),
        eq(homepageSlots.slotKey, slotKey),
      ),
    )
    .limit(1);
  return row?.contentItemId ?? null;
}

export async function resolveAnalyticsEnrichmentSnapshot(
  wire: AnalyticsWireEvent,
  claims: AnalyticsContextClaims | null = null,
): Promise<AnalyticsDecision<AnalyticsEnrichmentSnapshot>> {
  switch (wire.eventName) {
    case ANALYTICS_EVENT_NAME.ARTICLE_VIEW: {
      if (wire.properties.eventName !== "ARTICLE_VIEW") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      if (!claims?.contentItemId || !claims.publishedVersionId) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      return loadArticleSnapshotForVersion(claims.contentItemId, claims.publishedVersionId);
    }
    case ANALYTICS_EVENT_NAME.PAGE_VIEW: {
      if (wire.properties.eventName !== "PAGE_VIEW") {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      if (wire.surface === "WITHDRAWN_SHELL") {
        if (!wire.properties.contentItemId) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
        }
        return loadWithdrawnSnapshot(wire.properties.contentItemId);
      }
      return { ok: true, value: { type: "OTHER_PUBLIC" } };
    }
    case ANALYTICS_EVENT_NAME.HOMEPAGE_VIEW: {
      const homepageVersionId = claims?.homepageVersionId ?? wire.claimedHomepageVersionId ?? null;
      if (homepageVersionId) {
        if (!(await homepageVersionExists(homepageVersionId))) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        return { ok: true, value: { type: "HOMEPAGE_VIEW", homepageVersionId } };
      }
      return { ok: true, value: { type: "HOMEPAGE_VIEW", homepageVersionId: null } };
    }
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION:
    case ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK: {
      if (
        wire.properties.eventName !== "HOMEPAGE_CONTENT_IMPRESSION" &&
        wire.properties.eventName !== "HOMEPAGE_CONTENT_CLICK"
      ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      if (wire.properties.placement === ANALYTICS_PLACEMENT.CONVERSATION) {
        if (!claims?.contentItemId || !claims.publishedVersionId) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        const article = await loadArticleSnapshotForVersion(
          claims.contentItemId,
          claims.publishedVersionId,
        );
        if (!article.ok) {
          return article;
        }
        return {
          ok: true,
          value: {
            type: "HOMEPAGE_CONVERSATION",
            homepageVersionId: claims.homepageVersionId,
            contentItemId: article.value.contentItemId,
            publishedVersionId: article.value.publishedVersionId,
            position: wire.properties.position,
          },
        };
      }
      if (wire.properties.placement === ANALYTICS_PLACEMENT.RECENCY_FALLBACK) {
        if (
          !claims?.contentItemId ||
          !claims.publishedVersionId ||
          claims.placement !== ANALYTICS_PLACEMENT.RECENCY_FALLBACK ||
          claims.homepageVersionId !== null
        ) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        const article = await loadArticleSnapshotForVersion(
          claims.contentItemId,
          claims.publishedVersionId,
        );
        if (!article.ok) {
          return article;
        }
        return {
          ok: true,
          value: {
            type: "HOMEPAGE_FALLBACK",
            homepageVersionId: null,
            contentItemId: article.value.contentItemId,
            publishedVersionId: article.value.publishedVersionId,
            placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
            position: wire.properties.position,
          },
        };
      }
      if (
        !(ANALYTICS_HOMEPAGE_SLOT_PLACEMENTS as readonly string[]).includes(
          wire.properties.placement,
        )
      ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      const homepageVersionId = claims?.homepageVersionId ?? null;
      if (!homepageVersionId) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (!(await homepageVersionExists(homepageVersionId))) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      const slotContentId = await loadHomepageSlotContent(
        homepageVersionId,
        wire.properties.placement as HomepageSlotKey,
      );
      if (slotContentId !== wire.properties.contentItemId) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (!claims?.publishedVersionId) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      const article = await loadArticleSnapshotForVersion(
        wire.properties.contentItemId,
        claims.publishedVersionId,
      );
      if (!article.ok) {
        return article;
      }
      return {
        ok: true,
        value: {
          type: "HOMEPAGE_SLOT",
          homepageVersionId,
          contentItemId: article.value.contentItemId,
          publishedVersionId: article.value.publishedVersionId,
          placement: wire.properties.placement,
          position: wire.properties.position,
        },
      };
    }
    case ANALYTICS_EVENT_NAME.GALLERY_OPEN:
    case ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW:
    case ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE: {
      if (
        wire.properties.eventName !== "GALLERY_OPEN" &&
        wire.properties.eventName !== "GALLERY_IMAGE_VIEW" &&
        wire.properties.eventName !== "GALLERY_NAVIGATE"
      ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      if (!claims?.contentItemId || !claims.publishedVersionId) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      const article = await loadArticleSnapshotForVersion(
        claims.contentItemId,
        claims.publishedVersionId,
      );
      if (!article.ok) {
        return article;
      }
      const db = getDb();
      const [mediaRow] = await db
        .select({
          mediaId: contentVersionMedia.mediaId,
          sortOrder: contentVersionMedia.sortOrder,
        })
        .from(contentVersionMedia)
        .where(
          and(
            eq(contentVersionMedia.contentVersionId, article.value.publishedVersionId),
            eq(contentVersionMedia.role, MEDIA_ROLE.GALLERY),
            eq(contentVersionMedia.mediaId, wire.properties.mediaId),
            eq(contentVersionMedia.sortOrder, wire.properties.galleryPosition),
          ),
        )
        .limit(1);
      if (!mediaRow) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      return {
        ok: true,
        value: {
          type: "GALLERY",
          contentItemId: article.value.contentItemId,
          publishedVersionId: article.value.publishedVersionId,
          mediaId: mediaRow.mediaId,
          galleryPosition: mediaRow.sortOrder,
        },
      };
    }
    case ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION:
    case ANALYTICS_EVENT_NAME.VIDEO_PLAY: {
      if (
        wire.properties.eventName !== "VIDEO_IMPRESSION" &&
        wire.properties.eventName !== "VIDEO_PLAY"
      ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      const db = getDb();
      const [asset] = await db
        .select({
          id: editorialVideoAssets.id,
          provider: editorialVideoAssets.provider,
        })
        .from(editorialVideoAssets)
        .where(eq(editorialVideoAssets.id, wire.properties.videoAssetId))
        .limit(1);
      if (!asset) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      if (wire.properties.placement === ANALYTICS_PLACEMENT.ARTICLE_VIDEO) {
        if (!wire.properties.contentItemId || !claims?.publishedVersionId) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
        }
        const article = await loadArticleSnapshotForVersion(
          wire.properties.contentItemId,
          claims.publishedVersionId,
        );
        if (!article.ok) {
          return article;
        }
        const [relation] = await db
          .select({ videoAssetId: contentVersionVideos.videoAssetId })
          .from(contentVersionVideos)
          .where(
            and(
              eq(contentVersionVideos.contentVersionId, article.value.publishedVersionId),
              eq(contentVersionVideos.videoAssetId, asset.id),
            ),
          )
          .limit(1);
        if (!relation) {
          return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
        }
        return {
          ok: true,
          value: {
            type: "VIDEO_ARTICLE",
            videoAssetId: asset.id,
            provider: asset.provider,
            contentItemId: article.value.contentItemId,
            publishedVersionId: article.value.publishedVersionId,
          },
        };
      }
      const homepageVersionId = claims?.homepageVersionId ?? null;
      if (!homepageVersionId) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      const [homepageVideo] = await db
        .select({ videoAssetId: homepageVersionVideos.videoAssetId })
        .from(homepageVersionVideos)
        .where(
          and(
            eq(homepageVersionVideos.homepageVersionId, homepageVersionId),
            eq(homepageVersionVideos.videoAssetId, asset.id),
          ),
        )
        .limit(1);
      if (!homepageVideo) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      return {
        ok: true,
        value: {
          type: "VIDEO_HOMEPAGE",
          videoAssetId: asset.id,
          provider: asset.provider,
          homepageVersionId,
        },
      };
    }
    case ANALYTICS_EVENT_NAME.ARTICLE_OUTBOUND_CLICK:
    case ANALYTICS_EVENT_NAME.ARTICLE_INTERNAL_CLICK: {
      if (
        wire.properties.eventName !== "ARTICLE_OUTBOUND_CLICK" &&
        wire.properties.eventName !== "ARTICLE_INTERNAL_CLICK"
      ) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_PROPERTIES };
      }
      if (!claims?.contentItemId || !claims.publishedVersionId) {
        return { ok: false, code: ANALYTICS_ERROR.INVALID_CONTEXT };
      }
      const article = await loadArticleSnapshotForVersion(
        claims.contentItemId,
        claims.publishedVersionId,
      );
      if (!article.ok) {
        return article;
      }
      return {
        ok: true,
        value: {
          type: "ARTICLE_CLICK",
          contentItemId: article.value.contentItemId,
          publishedVersionId: article.value.publishedVersionId,
        },
      };
    }
    default:
      return { ok: false, code: ANALYTICS_ERROR.UNKNOWN_EVENT };
  }
}
