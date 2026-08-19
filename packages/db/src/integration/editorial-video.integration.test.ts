import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  MEDIA_TYPE,
  PUBLISHING_ERROR,
  PublishingError,
  STAFF_ROLE,
  VIDEO_ERROR,
  VideoError,
} from "@magazine/domain";
import {
  approveVersion,
  createDraftRevision,
  publishVersion,
  setDraftVersionVideos,
  submitForReview,
} from "../publishing";
import {
  createEditorVideoAsset,
  updateEditorVideoAsset,
} from "../editor";
import { getPublicArticleBySlug } from "../public/get-public-article";
import { getDb } from "../client";
import { media } from "../schema/media";
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

const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";
const ROLES = [STAFF_ROLE.SUPER_ADMIN];

function uniqueYouTubeId(): string {
  return randomUUID().replaceAll("-", "").slice(0, 11);
}

function uniqueVimeoId(): string {
  return String(100_000_000 + Math.floor(Math.random() * 800_000_000));
}

function assertVideoCode(error: unknown, code: string): void {
  assert.equal(error instanceof VideoError, true, String(error));
  assert.equal((error as VideoError).code, code);
}

function assertPublishingCode(error: unknown, code: string): void {
  assert.equal(error instanceof PublishingError, true, String(error));
  assert.equal((error as PublishingError).code, code);
}

async function insertTempVideoMedia(): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  await db.insert(media).values({
    id,
    storageKey: `itest/video-poster-reject-${id}`,
    mediaType: MEDIA_TYPE.VIDEO,
    mimeType: "video/mp4",
    width: 1920,
    height: 1080,
    byteSize: 4096,
  });
  return id;
}

describe("editorial video foundation", () => {
  let fixture: IntegrationFixture;
  const videoAssetIds: string[] = [];
  const tempMediaIds: string[] = [];

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    fixture = await createFixture();
    videoAssetIds.length = 0;
    tempMediaIds.length = 0;
  });

  afterEach(async () => {
    const itemIds = fixture.createdItemIds.slice();
    const pool = getRacerPool();
    if (videoAssetIds.length > 0) {
      await pool.query(
        "DELETE FROM content_version_videos WHERE video_asset_id = ANY($1::uuid[])",
        [videoAssetIds],
      );
      await pool.query(
        "DELETE FROM editorial_video_assets WHERE id = ANY($1::uuid[])",
        [videoAssetIds],
      );
    }
    if (tempMediaIds.length > 0) {
      await pool.query("DELETE FROM media WHERE id = ANY($1::uuid[])", [
        tempMediaIds,
      ]);
    }
    await cleanupFixture(fixture);
    await pool.query(`
      DELETE FROM editorial_video_assets AS asset
      WHERE NOT EXISTS (
        SELECT 1
        FROM content_version_videos AS relation
        WHERE relation.video_asset_id = asset.id
      )
    `);
    const leftover = await countLeftoverFixtures(itemIds);
    assert.equal(leftover.items, 0);
  });

  after(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    assert.equal(await countOpenTestTransactions(), 0);
    await closeIntegrationConnections();
  });

  it("creates, updates, de-duplicates, and validates poster IMAGE media", async () => {
    const youtubeId = uniqueYouTubeId();
    const vimeoId = uniqueVimeoId();
    const badPosterVimeoId = uniqueVimeoId();
    const created = await createEditorVideoAsset({
      roles: ROLES,
      video: {
        providerUrlOrId: `https://youtu.be/${youtubeId}`,
        title: "Launch video",
        caption: "Provider caption",
        durationSeconds: 42,
        posterMediaId: fixture.ids.media,
        rightsNote: "Provider terms reviewed.",
        provenance: "Editorial desk supplied.",
      },
    });
    videoAssetIds.push(created.id);

    assert.equal(created.provider, "YOUTUBE");
    assert.equal(created.providerVideoId, youtubeId);
    assert.equal(
      created.canonicalUrl,
      `https://www.youtube.com/watch?v=${youtubeId}`,
    );
    assert.equal(created.posterMediaId, fixture.ids.media);

    await assert.rejects(
      () =>
        createEditorVideoAsset({
          roles: ROLES,
          video: {
            providerUrlOrId: `https://www.youtube.com/embed/${youtubeId}`,
            title: "Duplicate",
          },
        }),
      (error: unknown) => {
        assertVideoCode(error, VIDEO_ERROR.DUPLICATE_VIDEO);
        return true;
      },
    );

    const updated = await updateEditorVideoAsset({
      videoAssetId: created.id,
      roles: ROLES,
      expectedUpdatedAt: created.updatedAt,
      video: {
        providerUrlOrId: `https://vimeo.com/${vimeoId}`,
        title: "Updated video",
        description: "Manual description",
        durationSeconds: null,
        posterMediaId: null,
      },
    });
    assert.equal(updated.provider, "VIMEO");
    assert.equal(updated.providerVideoId, vimeoId);
    assert.equal(updated.title, "Updated video");
    assert.equal(updated.posterMediaId, null);

    await assert.rejects(
      () =>
        updateEditorVideoAsset({
          videoAssetId: created.id,
          roles: ROLES,
          expectedUpdatedAt: created.updatedAt,
          video: {
            providerUrlOrId: `https://vimeo.com/${vimeoId}`,
            title: "Stale",
          },
        }),
      (error: unknown) => {
        assertVideoCode(error, VIDEO_ERROR.STALE_WRITE);
        return true;
      },
    );

    const videoMediaId = await insertTempVideoMedia();
    tempMediaIds.push(videoMediaId);
    await assert.rejects(
      () =>
        createEditorVideoAsset({
          roles: ROLES,
          video: {
            providerUrlOrId: `https://vimeo.com/${badPosterVimeoId}`,
            title: "Bad poster",
            posterMediaId: videoMediaId,
          },
        }),
      (error: unknown) => {
        assertVideoCode(error, VIDEO_ERROR.INVALID_POSTER);
        return true;
      },
    );
  });

  it("associates ordered videos with the draft version and exposes only published-version public video data", async () => {
    const youtubeId = uniqueYouTubeId();
    const vimeoId = uniqueVimeoId();
    const youtube = await createEditorVideoAsset({
      roles: ROLES,
      video: {
        providerUrlOrId: `https://youtu.be/${youtubeId}`,
        title: "Published YouTube",
        caption: "Asset caption",
        durationSeconds: 60,
        posterMediaId: fixture.ids.media,
        rightsNote: "Internal legal note",
        provenance: "Internal provenance",
      },
    });
    const vimeo = await createEditorVideoAsset({
      roles: ROLES,
      video: {
        providerUrlOrId: `https://vimeo.com/${vimeoId}`,
        title: "Draft Vimeo",
      },
    });
    videoAssetIds.push(youtube.id, vimeo.id);

    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      title: "Video article",
      body: articleBody("video-body"),
    });

    await assert.rejects(
      () =>
        setDraftVersionVideos({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          items: [
            { videoAssetId: youtube.id },
            { videoAssetId: youtube.id },
          ],
          scope: fixture.superAdmin,
          actorId: fixture.ids.staffEditor,
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.DUPLICATE_RELATION);
        return true;
      },
    );

    const assigned = await setDraftVersionVideos({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      items: [{ videoAssetId: youtube.id, caption: "Version caption" }],
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    assert.deepEqual(
      assigned.videos.map((item) => item.id),
      [youtube.id],
    );
    assert.equal(assigned.videos[0]?.caption, "Version caption");

    assert.equal(await getPublicArticleBySlug(created.slug), null);

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

    const publicA = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(publicA?.videos.length, 1);
    assert.equal(publicA?.videos[0]?.provider, "YOUTUBE");
    assert.equal(
      publicA?.videos[0]?.embedUrl,
      `https://www.youtube-nocookie.com/embed/${youtubeId}`,
    );
    assert.equal(publicA?.videos[0]?.caption, "Version caption");
    assert.equal(publicA?.videos[0]?.poster?.source, "EDITORIAL");
    assert.equal(JSON.stringify(publicA).includes("rightsNote"), false);
    assert.equal(JSON.stringify(publicA).includes("submittedUrl"), false);
    assert.equal(JSON.stringify(publicA).includes("provenance"), false);

    const revision = await createDraftRevision(
      created.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    const draft = await setDraftVersionVideos({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      items: [{ videoAssetId: vimeo.id, caption: "Draft-only Vimeo" }],
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    assert.equal(draft.videos[0]?.id, vimeo.id);

    const stillPublicA = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(stillPublicA?.videos.length, 1);
    assert.equal(stillPublicA?.videos[0]?.provider, "YOUTUBE");
    assert.equal(stillPublicA?.videos[0]?.caption, "Version caption");
  });
});
