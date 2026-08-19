import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { MEDIA_ROLE, MEDIA_TYPE } from "@magazine/domain";
import { eq } from "drizzle-orm";
import { getDb } from "../client";
import {
  listEditorContent,
  loadEditorHeroThumbnailsByVersionIds,
} from "../editor";
import {
  approveVersion,
  createDraftRevision,
  publishVersion,
  setDraftVersionHero,
  submitForReview,
} from "../publishing";
import { contentVersionMedia } from "../schema/content";
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
  type IntegrationFixture,
} from "./harness";

const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";

describe("editor homepage HERO thumbnail PostgreSQL", () => {
  let fixture: IntegrationFixture;

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    fixture = await createFixture();
  });

  afterEach(async () => {
    const itemIds = fixture.createdItemIds.slice();
    await cleanupFixture(fixture);
    const leftover = await countLeftoverFixtures(itemIds);
    assert.equal(leftover.items, 0);
    assert.equal(leftover.versions, 0);
  });

  after(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const leftoverTx = await countOpenTestTransactions();
    assert.equal(leftoverTx, 0, "integration tests leaked open transactions");
    await closeIntegrationConnections();
  });

  async function thumbnailForList(contentItemId: string) {
    const listed = await listEditorContent(
      { scopedCategoryIds: null },
      { limit: 50 },
      { mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL },
    );
    return listed.items.find((item) => item.id === contentItemId)?.heroThumbnail ?? null;
  }

  it("uses the published IMAGE HERO and ignores a later draft HERO B", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Published hero A",
      body: articleBody("published-hero-a"),
    });
    const submitted = await submitForReview(created.contentItemId, created.versionId, {
      expectedUpdatedAt: created.updatedAt,
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

    const publishedThumb = await thumbnailForList(created.contentItemId);
    assert.equal(
      publishedThumb?.url,
      `${MEDIA_PUBLIC_BASE_URL}/itest/${fixture.ids.media}`,
    );
    assert.equal(JSON.stringify(publishedThumb).includes("storageKey"), false);
    assert.equal(JSON.stringify(publishedThumb).includes("licenseNote"), false);

    const revision = await createDraftRevision(
      created.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    const draftHero = await setDraftVersionHero({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      mediaId: fixture.ids.extraMedia,
      altText: "Draft B",
      credit: null,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });

    const whileDraft = await thumbnailForList(created.contentItemId);
    assert.equal(whileDraft?.url, publishedThumb?.url);

    const draftOnly = await loadEditorHeroThumbnailsByVersionIds({
      versionIds: [draftHero.versionId],
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(
      draftOnly.get(draftHero.versionId)?.url,
      `${MEDIA_PUBLIC_BASE_URL}/itest/${fixture.ids.extraMedia}`,
    );

    const submittedDraft = await submitForReview(
      created.contentItemId,
      draftHero.versionId,
      {
        expectedUpdatedAt: draftHero.updatedAt,
        scope: fixture.superAdmin,
        actorId: fixture.ids.staffEditor,
      },
    );
    await approveVersion(created.contentItemId, draftHero.versionId, {
      expectedUpdatedAt: submittedDraft.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    await publishVersion(
      created.contentItemId,
      draftHero.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );

    const afterPublish = await thumbnailForList(created.contentItemId);
    assert.equal(
      afterPublish?.url,
      `${MEDIA_PUBLIC_BASE_URL}/itest/${fixture.ids.extraMedia}`,
    );
  });

  it("returns null when there is no HERO and ignores VIDEO HERO relations", async () => {
    const created = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: false,
      title: "No hero",
    });
    assert.equal(await thumbnailForList(created.contentItemId), null);

    const videoId = randomUUID();
    try {
      await getDb().insert(media).values({
        id: videoId,
        storageKey: `itest/video-${videoId}`,
        mediaType: MEDIA_TYPE.VIDEO,
        mimeType: "video/mp4",
        byteSize: 4096,
      });
      await getDb().insert(contentVersionMedia).values({
        contentVersionId: created.versionId,
        mediaId: videoId,
        role: MEDIA_ROLE.HERO,
        sortOrder: 0,
        caption: null,
        altText: "clip",
        credit: null,
      });

      const thumbs = await loadEditorHeroThumbnailsByVersionIds({
        versionIds: [created.versionId],
        mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      });
      assert.equal(thumbs.has(created.versionId), false);
      assert.equal(await thumbnailForList(created.contentItemId), null);
    } finally {
      await getDb().delete(contentVersionMedia).where(eq(contentVersionMedia.mediaId, videoId));
      await getDb().delete(media).where(eq(media.id, videoId));
    }
  });

  it("batches many version ids in one lookup", async () => {
    const first = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Batch one",
    });
    const second = await createDraftItem(fixture, {
      scope: fixture.superAdmin,
      includeRelations: true,
      title: "Batch two",
    });
    const thumbs = await loadEditorHeroThumbnailsByVersionIds({
      versionIds: [first.versionId, second.versionId, first.versionId],
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(thumbs.size, 2);
    assert.equal(thumbs.get(first.versionId)?.url?.includes(fixture.ids.media), true);
    assert.equal(thumbs.get(second.versionId)?.url?.includes(fixture.ids.media), true);
  });
});
