import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  MEDIA_ROLE,
  MEDIA_TYPE,
  PUBLISHING_ERROR,
  PublishingError,
} from "@magazine/domain";
import {
  approveVersion,
  createDraftRevision,
  publishVersion,
  setDraftVersionGallery,
  setDraftVersionHero,
  submitForReview,
  unpublishContent,
} from "../publishing";
import {
  clearPublishingTestHooks,
  setPublishingTestHooks,
} from "../publishing/test-hooks";
import { getPublicArticleBySlug } from "../public/get-public-article";
import { getDb } from "../client";
import { contentVersionMedia } from "../schema/content";
import { media } from "../schema/media";
import { inArray } from "drizzle-orm";
import {
  articleBody,
  cleanupFixture,
  closeIntegrationConnections,
  countLeftoverFixtures,
  countOpenTestTransactions,
  createDraftItem,
  createFixture,
  ensureEditorContentTestDatabase,
  snapshotContent,
  type IntegrationFixture,
} from "./harness";

const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";

function assertPublishingCode(error: unknown, code: string): void {
  assert.equal(error instanceof PublishingError, true, String(error));
  assert.equal((error as PublishingError).code, code);
}

async function insertTempImage() {
  const db = getDb();
  const id = randomUUID();
  await db.insert(media).values({
    id,
    storageKey: `itest/gallery-${id}`,
    mediaType: MEDIA_TYPE.IMAGE,
    mimeType: "image/jpeg",
    width: 1200,
    height: 800,
    byteSize: 2048,
    originalFilename: "gallery.jpg",
    creditLine: "Library credit",
  });
  return id;
}

async function insertTempVideo() {
  const db = getDb();
  const id = randomUUID();
  await db.insert(media).values({
    id,
    storageKey: `itest/gallery-video-${id}`,
    mediaType: MEDIA_TYPE.VIDEO,
    mimeType: "video/mp4",
    width: 1920,
    height: 1080,
    byteSize: 4096,
  });
  return id;
}

describe("draft version GALLERY mutations", () => {
  let fixture: IntegrationFixture;
  const extraIds: string[] = [];

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    fixture = await createFixture();
    extraIds.length = 0;
  });

  afterEach(async () => {
    clearPublishingTestHooks();
    const itemIds = fixture.createdItemIds.slice();
    const db = getDb();
    if (extraIds.length > 0) {
      await db
        .delete(contentVersionMedia)
        .where(inArray(contentVersionMedia.mediaId, extraIds));
      await db.delete(media).where(inArray(media.id, extraIds));
    }
    await cleanupFixture(fixture);
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

  it("assigns, orders, replaces, removes, and keeps HERO independent", async () => {
    const third = await insertTempImage();
    extraIds.push(third);
    const created = await createDraftItem(fixture, {
      includeRelations: true,
      title: "Gallery draft",
    });

    const assigned = await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      items: [
        { mediaId: fixture.ids.extraMedia, caption: "Two", altText: "alt-2" },
        { mediaId: fixture.ids.media, caption: "One", credit: "Override" },
        { mediaId: third, caption: "Three" },
      ],
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.deepEqual(
      assigned.gallery.map((item) => item.id),
      [fixture.ids.extraMedia, fixture.ids.media, third],
    );
    assert.equal(assigned.gallery[0]?.sortOrder, 0);
    assert.equal(assigned.gallery[1]?.caption, "One");
    assert.equal(assigned.gallery[1]?.credit, "Override");

    const snap = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(
      snap.media.some(
        (item) => item.role === MEDIA_ROLE.HERO && item.mediaId === fixture.ids.media,
      ),
      true,
    );
    assert.deepEqual(
      snap.media
        .filter((item) => item.role === MEDIA_ROLE.GALLERY)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((item) => item.mediaId),
      [fixture.ids.extraMedia, fixture.ids.media, third],
    );
    assert.deepEqual(
      snap.media
        .filter((item) => item.role === MEDIA_ROLE.GALLERY)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((item) => item.sortOrder),
      [0, 1, 2],
    );

    const reordered = await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: assigned.updatedAt,
      items: [
        { mediaId: third, caption: "Three" },
        { mediaId: fixture.ids.extraMedia, caption: "Two", altText: "alt-2" },
      ],
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.deepEqual(
      reordered.gallery.map((item) => item.id),
      [third, fixture.ids.extraMedia],
    );

    const cleared = await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: reordered.updatedAt,
      items: [],
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(cleared.gallery.length, 0);
    const afterClear = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(
      afterClear.media.filter((item) => item.role === MEDIA_ROLE.HERO).length,
      1,
    );
    assert.equal(
      afterClear.media.filter((item) => item.role === MEDIA_ROLE.GALLERY).length,
      0,
    );
  });

  it("rejects duplicates, VIDEO, missing media, and stale/concurrent writes", async () => {
    const videoId = await insertTempVideo();
    extraIds.push(videoId);
    const created = await createDraftItem(fixture, { title: "Gallery validation" });

    await assert.rejects(
      () =>
        setDraftVersionGallery({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          items: [
            { mediaId: fixture.ids.media },
            { mediaId: fixture.ids.media },
          ],
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          mediaPublicBaseUrl: undefined,
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.DUPLICATE_RELATION);
        return true;
      },
    );

    await assert.rejects(
      () =>
        setDraftVersionGallery({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          items: [{ mediaId: videoId }],
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          mediaPublicBaseUrl: undefined,
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.INVALID_GALLERY_MEDIA);
        return true;
      },
    );

    await assert.rejects(
      () =>
        setDraftVersionGallery({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          items: [{ mediaId: randomUUID() }],
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          mediaPublicBaseUrl: undefined,
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.RELATION_NOT_FOUND);
        return true;
      },
    );

    const first = await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      items: [{ mediaId: fixture.ids.media, caption: "A" }],
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: undefined,
    });

    await assert.rejects(
      () =>
        setDraftVersionGallery({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          items: [{ mediaId: fixture.ids.extraMedia, caption: "stale" }],
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          mediaPublicBaseUrl: undefined,
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
        return true;
      },
    );

    const [left, right] = await Promise.allSettled([
      setDraftVersionGallery({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt: first.updatedAt,
        items: [{ mediaId: fixture.ids.media, caption: "B" }],
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffEditor,
        mediaPublicBaseUrl: undefined,
      }),
      setDraftVersionGallery({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt: first.updatedAt,
        items: [{ mediaId: fixture.ids.extraMedia, caption: "C" }],
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffEditor,
        mediaPublicBaseUrl: undefined,
      }),
    ]);
    const fulfilled = [left, right].filter((item) => item.status === "fulfilled");
    const rejected = [left, right].filter((item) => item.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assertPublishingCode(
      (rejected[0] as PromiseRejectedResult).reason,
      PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT,
    );
    const snap = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(snap.media.filter((item) => item.role === MEDIA_ROLE.GALLERY).length, 1);
  });

  it("rolls back the previous gallery when the write fails after replacement", async () => {
    const created = await createDraftItem(fixture, {
      includeRelations: true,
      title: "Gallery rollback",
    });
    const assigned = await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      items: [{ mediaId: fixture.ids.extraMedia, caption: "keep" }],
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: undefined,
    });
    const before = await snapshotContent(created.contentItemId, created.versionId);

    setPublishingTestHooks({
      afterDraftGalleryReplaced: async ({ contentVersionId }) => {
        if (contentVersionId !== created.versionId) {
          return;
        }
        throw new Error("INTEGRATION_FORCED_GALLERY_ROLLBACK");
      },
    });

    await assert.rejects(
      () =>
        setDraftVersionGallery({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: assigned.updatedAt,
          items: [{ mediaId: fixture.ids.media, caption: "should not stick" }],
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          mediaPublicBaseUrl: undefined,
        }),
      (error: unknown) => {
        assert.equal((error as Error).message, "INTEGRATION_FORCED_GALLERY_ROLLBACK");
        return true;
      },
    );

    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.deepEqual(after.media, before.media);
  });

  it("keeps draft gallery private until publish and hides it after unpublish", async () => {
    const third = await insertTempImage();
    extraIds.push(third);
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Published gallery A",
      body: articleBody("gallery-body"),
    });
    const liveGallery = await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      items: [
        { mediaId: third, caption: "A1" },
        { mediaId: fixture.ids.extraMedia, caption: "A2", credit: "Desk" },
      ],
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    const submitted = await submitForReview(
      created.contentItemId,
      created.versionId,
      {
        expectedUpdatedAt: liveGallery.updatedAt,
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
    assert.deepEqual(
      publicA?.gallery.map((item) => item.caption),
      ["A1", "A2"],
    );
    assert.equal(publicA?.gallery[0]?.credit, "Library credit");
    assert.equal(publicA?.gallery[1]?.credit, "Desk");
    assert.equal(publicA?.gallery[0]?.mediaId, third);
    assert.equal(JSON.stringify(publicA).includes("storageKey"), false);
    assert.equal(JSON.stringify(publicA).includes("licenseNote"), false);

    const revision = await createDraftRevision(
      created.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      items: [{ mediaId: fixture.ids.extraMedia, caption: "Draft B" }],
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });

    const stillA = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.deepEqual(
      stillA?.gallery.map((item) => item.caption),
      ["A1", "A2"],
    );

    await unpublishContent(
      created.contentItemId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    assert.equal(await getPublicArticleBySlug(created.slug), null);
  });

  it("does not remove a HERO relation when the same asset is added to Gallery", async () => {
    const created = await createDraftItem(fixture, {
      includeRelations: true,
      title: "Hero plus gallery",
    });
    const assigned = await setDraftVersionGallery({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      items: [{ mediaId: fixture.ids.media, caption: "Also gallery" }],
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: undefined,
    });
    const snap = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(
      snap.media.filter(
        (item) => item.role === MEDIA_ROLE.HERO && item.mediaId === fixture.ids.media,
      ).length,
      1,
    );
    assert.equal(
      snap.media.filter(
        (item) => item.role === MEDIA_ROLE.GALLERY && item.mediaId === fixture.ids.media,
      ).length,
      1,
    );

    await setDraftVersionHero({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: assigned.updatedAt,
      mediaId: fixture.ids.extraMedia,
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: undefined,
    });
    const afterHero = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(
      afterHero.media.some(
        (item) => item.role === MEDIA_ROLE.GALLERY && item.mediaId === fixture.ids.media,
      ),
      true,
    );
    assert.equal(
      afterHero.media.some(
        (item) => item.role === MEDIA_ROLE.HERO && item.mediaId === fixture.ids.extraMedia,
      ),
      true,
    );
  });
});
