import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  MEDIA_ROLE,
  MEDIA_TYPE,
  PUBLICATION_STATUS,
  PUBLISHING_ERROR,
  PublishingError,
} from "@magazine/domain";
import {
  approveVersion,
  createDraftRevision,
  publishVersion,
  removeDraftVersionHero,
  setDraftVersionHero,
  submitForReview,
  updateDraftContent,
} from "../publishing";
import {
  clearPublishingTestHooks,
  setPublishingTestHooks,
} from "../publishing/test-hooks";
import { getPublicArticleBySlug } from "../public/get-public-article";
import { getDb } from "../client";
import { contentVersionMedia } from "../schema/content";
import { media } from "../schema/media";
import { eq, inArray } from "drizzle-orm";
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

function assertPublishingCode(error: unknown, code: string): void {
  assert.equal(error instanceof PublishingError, true, String(error));
  assert.equal((error as PublishingError).code, code);
}

async function publishThenDraft(fixture: IntegrationFixture) {
  const created = await createDraftItem(fixture, {
    scope: fixture.superAdmin,
    includeRelations: true,
    title: "Published hero source",
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
  const revision = await createDraftRevision(
    created.contentItemId,
    undefined,
    fixture.superAdmin,
    fixture.ids.staffEditor,
  );
  return { created, revision };
}

async function insertTempMedia(input: {
  mediaType: (typeof MEDIA_TYPE)[keyof typeof MEDIA_TYPE];
  mimeType: string;
}) {
  const db = getDb();
  const id = randomUUID();
  await db.insert(media).values({
    id,
    storageKey: `itest/hero-${id}`,
    mediaType: input.mediaType,
    mimeType: input.mimeType,
    width: input.mediaType === MEDIA_TYPE.IMAGE ? 800 : null,
    height: input.mediaType === MEDIA_TYPE.IMAGE ? 600 : null,
    byteSize: 2048,
    originalFilename: input.mediaType === MEDIA_TYPE.IMAGE ? "hero-c.jpg" : null,
  });
  return id;
}

describe("draft version HERO mutations", () => {
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
    assert.equal(leftover.versions, 0);
  });

  after(async () => {
    if (!process.env.DATABASE_URL && !process.env.EDITOR_CONTENT_TEST_DATABASE_URL) {
      return;
    }
    const leftoverTx = await countOpenTestTransactions();
    assert.equal(leftoverTx, 0, "integration tests leaked open transactions");
    await closeIntegrationConnections();
  });

  it("assigns, replaces, and removes a draft HERO atomically", async () => {
    const created = await createDraftItem(fixture, {
      includeRelations: false,
      title: "Hero assign",
    });

    const assigned = await setDraftVersionHero({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      mediaId: fixture.ids.media,
      altText: "Crowd at the gate",
      credit: "Desk photo",
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: "https://media.example.test/assets",
    });

    assert.equal(assigned.hero?.id, fixture.ids.media);
    assert.equal(assigned.hero?.altText, "Crowd at the gate");
    assert.equal(assigned.hero?.credit, "Desk photo");
    assert.equal(assigned.hero?.mediaType, MEDIA_TYPE.IMAGE);
    assert.equal("storageKey" in (assigned.hero ?? {}), false);

    const snap = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(snap.media.length, 1);
    assert.equal(snap.media[0]?.role, MEDIA_ROLE.HERO);
    assert.equal(snap.media[0]?.altText, "Crowd at the gate");

    const replaced = await setDraftVersionHero({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: assigned.updatedAt,
      mediaId: fixture.ids.extraMedia,
      altText: "Replacement",
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: "https://media.example.test/assets",
    });

    assert.equal(replaced.hero?.id, fixture.ids.extraMedia);
    const afterReplace = await snapshotContent(
      created.contentItemId,
      created.versionId,
    );
    const heroes = afterReplace.media.filter((item) => item.role === MEDIA_ROLE.HERO);
    assert.equal(heroes.length, 1);
    assert.equal(heroes[0]?.mediaId, fixture.ids.extraMedia);
    assert.equal(
      afterReplace.media.some((item) => item.mediaId === fixture.ids.media),
      false,
    );

    const db = getDb();
    const [originalAsset] = await db
      .select({ id: media.id })
      .from(media)
      .where(eq(media.id, fixture.ids.media));
    assert.equal(originalAsset?.id, fixture.ids.media);

    const removed = await removeDraftVersionHero({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: replaced.updatedAt,
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
    });
    assert.equal(removed.hero, null);
    const afterRemove = await snapshotContent(
      created.contentItemId,
      created.versionId,
    );
    assert.equal(afterRemove.media.length, 0);
  });

  it("keeps published HERO A while the draft uses HERO B", async () => {
    const { created, revision } = await publishThenDraft(fixture);
    const publicBefore = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: "https://media.example.test/assets",
    });
    assert.equal(
      publicBefore?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );

    await setDraftVersionHero({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      mediaId: fixture.ids.extraMedia,
      altText: "Draft B",
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: "https://media.example.test/assets",
    });

    const publicAfterDraft = await getPublicArticleBySlug(created.slug, {
      mediaPublicBaseUrl: "https://media.example.test/assets",
    });
    assert.equal(
      publicAfterDraft?.hero?.url,
      `https://media.example.test/assets/itest/${fixture.ids.media}`,
    );
    assert.equal(publicAfterDraft?.hero?.altText, "alt");

    const publishedSnap = await snapshotContent(
      created.contentItemId,
      created.versionId,
    );
    assert.equal(publishedSnap.media[0]?.mediaId, fixture.ids.media);
    const draftSnap = await snapshotContent(
      created.contentItemId,
      revision.versionId,
    );
    assert.equal(draftSnap.media[0]?.mediaId, fixture.ids.extraMedia);
    assert.equal(draftSnap.publicationStatus, PUBLICATION_STATUS.PUBLISHED);
  });

  it("rejects stale expectedUpdatedAt and concurrent HERO writes", async () => {
    const created = await createDraftItem(fixture, { title: "Conflict hero" });
    const first = await setDraftVersionHero({
      contentItemId: created.contentItemId,
      versionId: created.versionId,
      expectedUpdatedAt: created.updatedAt,
      mediaId: fixture.ids.media,
      altText: "B",
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      mediaPublicBaseUrl: undefined,
    });

    await assert.rejects(
      () =>
        setDraftVersionHero({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          mediaId: fixture.ids.extraMedia,
          altText: "C",
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
      setDraftVersionHero({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt: first.updatedAt,
        mediaId: fixture.ids.media,
        altText: "B-again",
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffEditor,
        mediaPublicBaseUrl: undefined,
      }),
      setDraftVersionHero({
        contentItemId: created.contentItemId,
        versionId: created.versionId,
        expectedUpdatedAt: first.updatedAt,
        mediaId: fixture.ids.extraMedia,
        altText: "C-race",
        scope: fixture.selectedOnA,
        actorId: fixture.ids.staffEditor,
        mediaPublicBaseUrl: undefined,
      }),
    ]);
    const outcomes = [left, right];
    const fulfilled = outcomes.filter((item) => item.status === "fulfilled");
    const rejected = outcomes.filter((item) => item.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assertPublishingCode(
      (rejected[0] as PromiseRejectedResult).reason,
      PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT,
    );

    const snap = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(snap.media.filter((item) => item.role === MEDIA_ROLE.HERO).length, 1);
  });

  it("rejects VIDEO HERO, missing media, and out-of-scope editors", async () => {
    const videoId = await insertTempMedia({
      mediaType: MEDIA_TYPE.VIDEO,
      mimeType: "video/mp4",
    });
    extraIds.push(videoId);
    const created = await createDraftItem(fixture, { title: "Type check" });

    await assert.rejects(
      () =>
        setDraftVersionHero({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          mediaId: videoId,
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          mediaPublicBaseUrl: undefined,
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.INVALID_HERO_MEDIA);
        return true;
      },
    );

    await assert.rejects(
      () =>
        setDraftVersionHero({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          mediaId: randomUUID(),
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          mediaPublicBaseUrl: undefined,
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.RELATION_NOT_FOUND);
        return true;
      },
    );

    await assert.rejects(
      () =>
        setDraftVersionHero({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          mediaId: fixture.ids.media,
          scope: fixture.selectedOnB,
          actorId: fixture.ids.staffEditor,
          mediaPublicBaseUrl: undefined,
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
        return true;
      },
    );

    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(after.media.length, 0);
  });

  it("rolls back to the previous HERO when the write fails after replacement", async () => {
    const created = await createDraftItem(fixture, {
      includeRelations: true,
      title: "Rollback hero",
    });
    const before = await snapshotContent(created.contentItemId, created.versionId);
    assert.equal(before.media[0]?.mediaId, fixture.ids.media);

    setPublishingTestHooks({
      afterDraftHeroReplaced: async ({ contentVersionId }) => {
        if (contentVersionId !== created.versionId) {
          return;
        }
        throw new Error("INTEGRATION_FORCED_HERO_ROLLBACK");
      },
    });

    await assert.rejects(
      () =>
        setDraftVersionHero({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          mediaId: fixture.ids.extraMedia,
          altText: "should not stick",
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          mediaPublicBaseUrl: undefined,
        }),
      (error: unknown) => {
        assert.equal((error as Error).message, "INTEGRATION_FORCED_HERO_ROLLBACK");
        return true;
      },
    );

    const after = await snapshotContent(created.contentItemId, created.versionId);
    assert.deepEqual(after.media, before.media);
  });

  it("does not let a full draft save attach VIDEO as HERO", async () => {
    const videoId = await insertTempMedia({
      mediaType: MEDIA_TYPE.VIDEO,
      mimeType: "video/mp4",
    });
    extraIds.push(videoId);
    const created = await createDraftItem(fixture, { title: "Save type check" });

    await assert.rejects(
      () =>
        updateDraftContent({
          contentItemId: created.contentItemId,
          versionId: created.versionId,
          expectedUpdatedAt: created.updatedAt,
          title: "Save type check",
          body: articleBody("hero-type"),
          scope: fixture.selectedOnA,
          actorId: fixture.ids.staffEditor,
          categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
          media: [
            {
              mediaId: videoId,
              role: MEDIA_ROLE.HERO,
              sortOrder: 0,
              altText: "nope",
            },
          ],
        }),
      (error: unknown) => {
        assertPublishingCode(error, PUBLISHING_ERROR.INVALID_HERO_MEDIA);
        return true;
      },
    );
  });
});
