import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
  ANALYTICS_APP_ENV,
  ANALYTICS_CONSENT_STATE,
  ANALYTICS_ERROR,
  ANALYTICS_EVENT_NAME,
  ANALYTICS_PLACEMENT,
  ANALYTICS_SURFACE,
  ANALYTICS_TAXONOMY_VERSION,
  ANALYTICS_TRAFFIC_KIND,
  CONTENT_LEGAL_ACTION_TYPE,
  CONTENT_LEGAL_REASON_CATEGORY,
  HOMEPAGE_SLOT_KEY,
  STAFF_ROLE,
  analyticsEventLeaksSensitiveMaterial,
  signAnalyticsContext,
} from "@magazine/domain";
import { ingestPublicAnalyticsEvent } from "../analytics";
import { getDb } from "../client";
import {
  createEditorVideoAsset,
  getHomepageBuilder,
  publishHomepage,
  setHomepageSlot,
} from "../editor";
import { getPublicHomepage } from "../public";
import {
  approveVersion,
  publishVersion,
  recordContentLegalAction,
  setDraftVersionGallery,
  setDraftVersionVideos,
  submitForReview,
  createDraftRevision,
} from "../publishing";
import { analyticsEvents } from "../schema/analytics-events";
import {
  articleBody,
  cleanupFixture,
  closeIntegrationConnections,
  countLeftoverFixtures,
  countOpenTestTransactions,
  createDraftItem,
  createFixture,
  ensureEditorContentTestDatabase,
  getRacerPool,
  type IntegrationFixture,
} from "./harness";

const SITE_URL = "https://www.example.com";
const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";
const SIGNING_KEY = "test-analytics-context-signing-key-32";

function ingestContext() {
  return {
    receivedAt: new Date("2026-08-21T08:00:10.000Z"),
    appEnv: ANALYTICS_APP_ENV.PRODUCTION,
    consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
    trustedSiteOrigin: SITE_URL,
    referrerUrl: "https://www.google.com/search?q=secret-query",
    trafficSignals: {},
    analyticsContextSigningKey: SIGNING_KEY,
  };
}

function articleContext(contentItemId: string, publishedVersionId: string, occurredAt = "2026-08-21T08:00:00.000Z") {
  return signAnalyticsContext({
    signingKey: SIGNING_KEY,
    now: new Date(occurredAt),
    surface: ANALYTICS_SURFACE.ARTICLE,
    contentItemId,
    publishedVersionId,
  });
}

function homepageFallbackContext(input: {
  contentItemId: string;
  publishedVersionId: string;
  position: number;
  occurredAt?: string;
}) {
  return signAnalyticsContext({
    signingKey: SIGNING_KEY,
    now: new Date(input.occurredAt ?? "2026-08-21T08:00:00.000Z"),
    surface: ANALYTICS_SURFACE.HOMEPAGE,
    contentItemId: input.contentItemId,
    publishedVersionId: input.publishedVersionId,
    homepageVersionId: null,
    placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
    position: input.position,
  });
}

function homepageSlotContext(input: {
  contentItemId: string;
  publishedVersionId: string;
  homepageVersionId: string;
  placement: typeof ANALYTICS_PLACEMENT.LEAD | string;
  position: number;
  occurredAt?: string;
}) {
  return signAnalyticsContext({
    signingKey: SIGNING_KEY,
    now: new Date(input.occurredAt ?? "2026-08-21T08:00:00.000Z"),
    surface: ANALYTICS_SURFACE.HOMEPAGE,
    contentItemId: input.contentItemId,
    publishedVersionId: input.publishedVersionId,
    homepageVersionId: input.homepageVersionId,
    placement: input.placement as typeof ANALYTICS_PLACEMENT.LEAD,
    position: input.position,
  });
}

describe("analytics public ingestion PostgreSQL", () => {
  let fixture: IntegrationFixture;
  const videoAssetIds: string[] = [];

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    fixture = await createFixture();
    videoAssetIds.length = 0;
  });

  afterEach(async () => {
    const pool = getRacerPool();
    const exists = await pool.query<{ exists: boolean }>(
      `SELECT to_regclass('public.analytics_events') IS NOT NULL AS exists`,
    );
    if (exists.rows[0]?.exists === true) {
      await pool.query("DELETE FROM analytics_events");
    }
    if (videoAssetIds.length > 0) {
      await pool.query(
        "DELETE FROM content_version_videos WHERE video_asset_id = ANY($1::uuid[])",
        [videoAssetIds],
      );
      await pool.query(
        "DELETE FROM homepage_version_videos WHERE video_asset_id = ANY($1::uuid[])",
        [videoAssetIds],
      );
      await pool.query(
        "DELETE FROM editorial_video_assets WHERE id = ANY($1::uuid[])",
        [videoAssetIds],
      );
    }
    const itemIds = fixture.createdItemIds.slice();
    await cleanupFixture(fixture);
    const leftover = await countLeftoverFixtures(itemIds);
    assert.equal(leftover.items, 0);
  });

  after(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const leftoverTx = await countOpenTestTransactions();
    assert.equal(leftoverTx, 0, "integration tests leaked open transactions");
    await closeIntegrationConnections();
  });

  async function publishApproved(input: {
    title: string;
    includeRelations?: boolean;
  }) {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: input.includeRelations ?? true,
      title: input.title,
      body: articleBody(input.title),
    });
    const submitted = await submitForReview(
      created.contentItemId,
      created.versionId,
      {
        expectedUpdatedAt: created.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(created.contentItemId, created.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    const published = await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    return { ...created, published };
  }

  async function publishSuccessor(contentItemId: string) {
    const revision = await createDraftRevision(
      contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    const submitted = await submitForReview(contentItemId, revision.versionId, {
      expectedUpdatedAt: revision.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    await approveVersion(contentItemId, revision.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await publishVersion(
      contentItemId,
      revision.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    return revision.versionId;
  }

  it("accepts ARTICLE_VIEW with server-owned dimensions and receivedAt", async () => {
    const article = await publishApproved({ title: "Analytics live article" });
    const eventId = randomUUID();
    const token = articleContext(article.contentItemId, article.versionId);
    const result = await ingestPublicAnalyticsEvent(
      {
        eventId,
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: token,
        properties: {
          contentItemId: article.contentItemId,
          primaryCategoryId: randomUUID(),
          authorIds: [randomUUID()],
        },
      },
      ingestContext(),
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.outcome, "INSERTED");

    const [row] = await getDb()
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventId, eventId));
    assert.equal(row?.eventName, ANALYTICS_EVENT_NAME.ARTICLE_VIEW);
    assert.equal(row?.publishedVersionId, article.versionId);
    assert.equal(row?.primaryCategoryId, fixture.ids.categoryA);
    assert.deepEqual(row?.authorIds, [fixture.ids.author]);
    assert.equal(row?.receivedAt.toISOString(), "2026-08-21T08:00:10.000Z");
    assert.equal(row?.referrerHost, "google.com");
    assert.equal(row?.anonymousVisitorId, null);
    assert.equal(analyticsEventLeaksSensitiveMaterial(row?.properties), false);
    assert.equal(JSON.stringify(row).includes(token), false);
    assert.equal(JSON.stringify(row).includes("secret-query"), false);
    assert.equal(JSON.stringify(row).includes("staffUserId"), false);
  });

  it("rejects draft ARTICLE_VIEW and withdrawn shells as normal article traffic", async () => {
    const draft = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title: "Draft only",
      body: articleBody("draft"),
    });
    const draftResult = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: articleContext(draft.contentItemId, draft.versionId),
        properties: { contentItemId: draft.contentItemId },
      },
      ingestContext(),
    );
    assert.equal(draftResult.ok, false);
    if (!draftResult.ok) {
      assert.equal(draftResult.code, ANALYTICS_ERROR.NOT_PUBLIC);
    }

    const live = await publishApproved({ title: "Soon retracted" });
    await recordContentLegalAction({
      contentItemId: live.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.EDITORIAL_STANDARDS,
      internalNote: "Do not leak this note",
      publicNote: "This article was retracted.",
      expectedUpdatedAt: live.published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    const withdrawnView = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: articleContext(live.contentItemId, live.versionId),
        properties: { contentItemId: live.contentItemId },
      },
      ingestContext(),
    );
    assert.equal(withdrawnView.ok, false);

    const shell = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.PAGE_VIEW,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.WITHDRAWN_SHELL,
        properties: { contentItemId: live.contentItemId },
      },
      ingestContext(),
    );
    assert.equal(shell.ok, true);
    if (!shell.ok) return;
    if (shell.value.event.eventName !== ANALYTICS_EVENT_NAME.PAGE_VIEW) return;
    assert.equal(shell.value.event.properties.withdrawalKind, "RETRACTION");
    assert.equal("internalNote" in shell.value.event.properties, false);
  });

  it("dedupes identical eventIds and conflicts on a different payload", async () => {
    const article = await publishApproved({ title: "Dedupe article" });
    const eventId = randomUUID();
    const payload = {
      eventId,
      eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: "2026-08-21T08:00:00.000Z",
      surface: ANALYTICS_SURFACE.ARTICLE,
      analyticsContext: articleContext(article.contentItemId, article.versionId),
      properties: { contentItemId: article.contentItemId },
    };
    const first = await ingestPublicAnalyticsEvent(payload, ingestContext());
    const second = await ingestPublicAnalyticsEvent(payload, ingestContext());
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (first.ok) assert.equal(first.value.outcome, "INSERTED");
    if (second.ok) assert.equal(second.value.outcome, "DEDUPLICATED");

    const conflict = await ingestPublicAnalyticsEvent(
      { ...payload, occurredAt: "2026-08-21T08:00:01.000Z" },
      ingestContext(),
    );
    assert.equal(conflict.ok, false);
    if (!conflict.ok) {
      assert.equal(conflict.code, ANALYTICS_ERROR.EVENT_ID_CONFLICT);
    }

    const rows = await getDb()
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventId, eventId));
    assert.equal(rows.length, 1);
  });

  it("stores a single fact for concurrent duplicate submissions", async () => {
    const article = await publishApproved({ title: "Concurrent article" });
    const eventId = randomUUID();
    const payload = {
      eventId,
      eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
      schemaVersion: ANALYTICS_TAXONOMY_VERSION,
      occurredAt: "2026-08-21T08:00:00.000Z",
      surface: ANALYTICS_SURFACE.ARTICLE,
      analyticsContext: articleContext(article.contentItemId, article.versionId),
      properties: { contentItemId: article.contentItemId },
    };
    const [left, right] = await Promise.all([
      ingestPublicAnalyticsEvent(payload, ingestContext()),
      ingestPublicAnalyticsEvent(payload, ingestContext()),
    ]);
    assert.equal(left.ok && right.ok, true);
    const outcomes = [left, right]
      .filter((item) => item.ok)
      .map((item) => (item.ok ? item.value.outcome : null));
    assert.equal(outcomes.filter((item) => item === "INSERTED").length, 1);
    assert.equal(outcomes.filter((item) => item === "DEDUPLICATED").length, 1);
    const rows = await getDb()
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventId, eventId));
    assert.equal(rows.length, 1);
  });

  it("rejects a fake homepage slot and accepts the authoritative LEAD assignment", async () => {
    const lead = await publishApproved({ title: "Lead story" });
    const other = await publishApproved({ title: "Other story" });
    let builder = await getHomepageBuilder(
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    builder = await setHomepageSlot({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
      slotKey: HOMEPAGE_SLOT_KEY.LEAD,
      contentItemId: lead.contentItemId,
    });
    const publishedHome = await publishHomepage({
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      expectedUpdatedAt: builder.updatedAt,
    });
    const homepageVersionId = publishedHome.published?.versionId;
    assert.equal(typeof homepageVersionId, "string");

    const fake = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: homepageSlotContext({
          contentItemId: other.contentItemId,
          publishedVersionId: other.versionId,
          homepageVersionId: homepageVersionId as string,
          placement: ANALYTICS_PLACEMENT.LEAD,
          position: 1,
        }),
        properties: {
          contentItemId: other.contentItemId,
          homepageVersionId,
          placement: ANALYTICS_PLACEMENT.LEAD,
          position: 1,
          pageViewContextId: randomUUID(),
        },
      },
      ingestContext(),
    );
    assert.equal(fake.ok, false);

    const accepted = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: homepageSlotContext({
          contentItemId: lead.contentItemId,
          publishedVersionId: lead.versionId,
          homepageVersionId: homepageVersionId as string,
          placement: ANALYTICS_PLACEMENT.LEAD,
          position: 1,
        }),
        properties: {
          contentItemId: lead.contentItemId,
          homepageVersionId,
          placement: ANALYTICS_PLACEMENT.LEAD,
          position: 1,
          pageViewContextId: randomUUID(),
        },
      },
      ingestContext(),
    );
    assert.equal(accepted.ok, true);
  });

  it("requires gallery media to belong to the published version", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Gallery article",
      body: articleBody("gallery"),
    });
    const withGallery = await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      items: [{ mediaId: fixture.ids.extraMedia, caption: "Slide" }],
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const submitted = await submitForReview(
      created.contentItemId,
      created.versionId,
      {
        expectedUpdatedAt: withGallery.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(created.contentItemId, created.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const fake = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: articleContext(created.contentItemId, created.versionId),
        properties: {
          contentItemId: created.contentItemId,
          mediaId: fixture.ids.media,
          galleryPosition: 0,
        },
      },
      ingestContext(),
    );
    assert.equal(fake.ok, false);

    const accepted = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.GALLERY_OPEN,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: articleContext(created.contentItemId, created.versionId),
        properties: {
          contentItemId: created.contentItemId,
          mediaId: fixture.ids.extraMedia,
          galleryPosition: 0,
        },
      },
      ingestContext(),
    );
    assert.equal(accepted.ok, true);
  });

  it("derives video provider from the asset and rejects unrelated assets", async () => {
    const youtube = await createEditorVideoAsset({
      roles: [STAFF_ROLE.SUPER_ADMIN],
      video: {
        providerUrlOrId: `https://youtu.be/${randomUUID().replaceAll("-", "").slice(0, 11)}`,
        title: "Analytics youtube",
      },
    });
    const vimeo = await createEditorVideoAsset({
      roles: [STAFF_ROLE.SUPER_ADMIN],
      video: {
        providerUrlOrId: `https://vimeo.com/${100_000_000 + Math.floor(Math.random() * 800_000_000)}`,
        title: "Unrelated vimeo",
      },
    });
    videoAssetIds.push(youtube.id, vimeo.id);

    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title: "Video article",
      body: articleBody("video"),
    });
    const assigned = await setDraftVersionVideos({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      items: [{ videoAssetId: youtube.id }],
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    const submitted = await submitForReview(
      created.contentItemId,
      created.versionId,
      {
        expectedUpdatedAt: assigned.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(created.contentItemId, created.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const unrelated = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: articleContext(created.contentItemId, created.versionId),
        properties: {
          videoAssetId: vimeo.id,
          contentItemId: created.contentItemId,
          placement: ANALYTICS_PLACEMENT.ARTICLE_VIDEO,
        },
      },
      ingestContext(),
    );
    assert.equal(unrelated.ok, false);

    const accepted = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: articleContext(created.contentItemId, created.versionId),
        properties: {
          videoAssetId: youtube.id,
          provider: "VIMEO",
          contentItemId: created.contentItemId,
          placement: ANALYTICS_PLACEMENT.ARTICLE_VIDEO,
        },
      },
      ingestContext(),
    );
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    if (accepted.value.event.eventName !== ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION) return;
    assert.equal(accepted.value.event.properties.provider, "YOUTUBE");
  });

  it("does not let client-declared HUMAN override non-production TEST traffic", async () => {
    const article = await publishApproved({ title: "Test env article" });
    const result = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: articleContext(article.contentItemId, article.versionId),
        properties: {
          contentItemId: article.contentItemId,
          trafficKind: ANALYTICS_TRAFFIC_KIND.HUMAN,
        },
      },
      {
        ...ingestContext(),
        appEnv: ANALYTICS_APP_ENV.DEVELOPMENT,
      },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.event.trafficKind, ANALYTICS_TRAFFIC_KIND.TEST);
  });

  it("keeps delayed article, gallery, and video events on VERSION_A after VERSION_B is published", async () => {
    const youtube = await createEditorVideoAsset({
      roles: [STAFF_ROLE.SUPER_ADMIN],
      video: {
        providerUrlOrId: `https://youtu.be/${randomUUID().replaceAll("-", "").slice(0, 11)}`,
        title: "Version A video",
      },
    });
    videoAssetIds.push(youtube.id);

    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Version A public",
      body: articleBody("Version A public"),
    });
    const withGallery = await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      items: [{ mediaId: fixture.ids.extraMedia, caption: "Slide" }],
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const withVideo = await setDraftVersionVideos({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: withGallery.updatedAt,
      items: [{ videoAssetId: youtube.id }],
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    const submitted = await submitForReview(created.contentItemId, created.versionId, {
      expectedUpdatedAt: withVideo.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    await approveVersion(created.contentItemId, created.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const versionA = created.versionId;
    const token = articleContext(created.contentItemId, versionA);
    const versionB = await publishSuccessor(created.contentItemId);
    assert.notEqual(versionB, versionA);

    const delayedView = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: token,
        properties: { contentItemId: created.contentItemId },
      },
      ingestContext(),
    );
    assert.equal(delayedView.ok, true);
    if (!delayedView.ok) return;
    if (delayedView.value.event.eventName !== ANALYTICS_EVENT_NAME.ARTICLE_VIEW) return;
    assert.equal(delayedView.value.event.properties.publishedVersionId, versionA);
    assert.notEqual(delayedView.value.event.properties.publishedVersionId, versionB);
    assert.equal(JSON.stringify(delayedView.value.event).includes(token), false);

    const delayedGallery = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.GALLERY_OPEN,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: token,
        properties: {
          contentItemId: created.contentItemId,
          mediaId: fixture.ids.extraMedia,
          galleryPosition: 0,
        },
      },
      ingestContext(),
    );
    assert.equal(delayedGallery.ok, true);
    if (!delayedGallery.ok) return;
    if (delayedGallery.value.event.eventName !== ANALYTICS_EVENT_NAME.GALLERY_OPEN) return;
    assert.equal(delayedGallery.value.event.properties.publishedVersionId, versionA);

    const delayedVideo = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.ARTICLE,
        analyticsContext: token,
        properties: {
          videoAssetId: youtube.id,
          contentItemId: created.contentItemId,
          placement: ANALYTICS_PLACEMENT.ARTICLE_VIDEO,
        },
      },
      ingestContext(),
    );
    assert.equal(delayedVideo.ok, true);
    if (!delayedVideo.ok) return;
    if (delayedVideo.value.event.eventName !== ANALYTICS_EVENT_NAME.VIDEO_IMPRESSION) return;
    assert.equal(delayedVideo.value.event.properties.publishedVersionId, versionA);
  });

  it("accepts recency fallback context and rejects a fake fallback placement", async () => {
    const story = await publishApproved({ title: "Fallback story" });
    const homepage = await getPublicHomepage({
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      analyticsContextSigningKey: SIGNING_KEY,
      analyticsContextNow: new Date("2026-08-21T08:00:00.000Z"),
    });
    const fallback = homepage.analyticsPlacements.find(
      (placement) =>
        placement.placement === ANALYTICS_PLACEMENT.RECENCY_FALLBACK &&
        placement.contentItemId === story.contentItemId,
    );
    assert.equal(typeof fallback?.analyticsContext, "string");

    const accepted = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: fallback?.analyticsContext,
        properties: {
          contentItemId: story.contentItemId,
          placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
          position: fallback?.position,
          pageViewContextId: randomUUID(),
        },
      },
      ingestContext(),
    );
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    if (accepted.value.event.eventName !== ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_IMPRESSION) {
      return;
    }
    assert.equal(accepted.value.event.properties.placement, ANALYTICS_PLACEMENT.RECENCY_FALLBACK);
    assert.equal(accepted.value.event.properties.homepageVersionId, null);

    const fake = await ingestPublicAnalyticsEvent(
      {
        eventId: randomUUID(),
        eventName: ANALYTICS_EVENT_NAME.HOMEPAGE_CONTENT_CLICK,
        schemaVersion: ANALYTICS_TAXONOMY_VERSION,
        occurredAt: "2026-08-21T08:00:00.000Z",
        surface: ANALYTICS_SURFACE.HOMEPAGE,
        analyticsContext: homepageFallbackContext({
          contentItemId: story.contentItemId,
          publishedVersionId: story.versionId,
          position: 0,
        }),
        properties: {
          contentItemId: story.contentItemId,
          placement: ANALYTICS_PLACEMENT.LEAD,
          position: 1,
          pageViewContextId: randomUUID(),
        },
      },
      ingestContext(),
    );
    assert.equal(fake.ok, false);
    if (!fake.ok) {
      assert.equal(fake.code, ANALYTICS_ERROR.INVALID_CONTEXT);
    }
  });
});
