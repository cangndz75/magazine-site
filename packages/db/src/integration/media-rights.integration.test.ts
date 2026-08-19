import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import {
  MEDIA_LICENSE_TYPE,
  MEDIA_PUBLIC_INELIGIBILITY_REASON,
  MEDIA_RIGHTS_ERROR,
  MEDIA_RIGHTS_STATUS,
  MEDIA_ROLE,
  MEDIA_SOURCE_KIND,
  MEDIA_USAGE_RESTRICTION,
  MediaRightsError,
  STAFF_ROLE,
} from "@magazine/domain";
import { getDb } from "../client";
import { getEditorMediaDetail, updateMediaRights } from "../editor";
import {
  approveVersion,
  createContent,
  createDraftRevision,
  publishVersion,
  submitForReview,
} from "../publishing";
import { loadPublishedHeroMedia } from "../public";
import { contentVersionMedia } from "../schema/content";
import { media } from "../schema/media";
import {
  articleBody,
  cleanupFixture,
  closeIntegrationConnections,
  createFixture,
  ensureEditorContentTestDatabase,
  insertLegacyMedia,
  primaryA,
  wipeMediaRightsTestRows,
  type IntegrationFixture,
} from "./harness";

const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";
const NOW = new Date("2026-08-19T12:00:00.000Z");

describe("media rights PostgreSQL", () => {
  let fixture: IntegrationFixture;

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    fixture = await createFixture();
  });

  afterEach(async () => {
    await cleanupFixture(fixture);
    await wipeMediaRightsTestRows();
  });

  after(async () => {
    await closeIntegrationConnections();
  });

  async function trackMedia(suffix: string) {
    return insertLegacyMedia(`itest/media-rights-${suffix}`);
  }

  it("applies UNKNOWN/NONE defaults so existing media rows remain valid", async () => {
    const row = await trackMedia(randomUUID());
    const db = getDb();
    const [stored] = await db.select().from(media).where(eq(media.id, row.id)).limit(1);
    assert.equal(stored?.sourceKind, MEDIA_SOURCE_KIND.UNKNOWN);
    assert.equal(stored?.licenseType, MEDIA_LICENSE_TYPE.UNKNOWN);
    assert.equal(stored?.usageRestriction, MEDIA_USAGE_RESTRICTION.NONE);
    assert.equal(stored?.licenseNote, null);

    const detail = await getEditorMediaDetail({
      mediaId: row.id,
      roles: [STAFF_ROLE.EDITOR],
      now: NOW,
    });
    assert.equal(detail.eligibility.eligible, false);
    assert.equal(detail.eligibility.status, MEDIA_RIGHTS_STATUS.INCOMPLETE);
    assert.deepEqual(detail.eligibility.reasons, [
      MEDIA_PUBLIC_INELIGIBILITY_REASON.RIGHTS_INCOMPLETE,
    ]);
  });

  it("writes and reads canonical rights metadata for authorized editors", async () => {
    const row = await trackMedia(randomUUID());
    const updated = await updateMediaRights({
      mediaId: row.id,
      roles: [STAFF_ROLE.EDITOR],
      now: NOW,
      rights: {
        sourceKind: MEDIA_SOURCE_KIND.OWNED,
        rightsHolder: "Magazine Ltd",
        licenseType: MEDIA_LICENSE_TYPE.ALL_RIGHTS,
        creditLine: "Foto: Editor",
        usageRestriction: MEDIA_USAGE_RESTRICTION.NONE,
      },
    });
    assert.equal(updated.eligibility.status, MEDIA_RIGHTS_STATUS.CLEARED);
    assert.equal(updated.eligibility.eligible, true);
  });

  it("forbids rights writes without CONTENT_EDIT", async () => {
    const row = await trackMedia(randomUUID());
    await assert.rejects(
      () =>
        updateMediaRights({
          mediaId: row.id,
          roles: [],
          now: NOW,
          rights: {
            sourceKind: MEDIA_SOURCE_KIND.OWNED,
            rightsHolder: "Magazine Ltd",
            licenseType: MEDIA_LICENSE_TYPE.ALL_RIGHTS,
            creditLine: "Foto: Editor",
            usageRestriction: MEDIA_USAGE_RESTRICTION.NONE,
          },
        }),
      (error: unknown) =>
        error instanceof MediaRightsError &&
        error.code === MEDIA_RIGHTS_ERROR.FORBIDDEN,
    );
  });

  it("rejects an inverted license window before writing", async () => {
    const row = await trackMedia(randomUUID());
    await assert.rejects(
      () =>
        updateMediaRights({
          mediaId: row.id,
          roles: [STAFF_ROLE.EDITOR],
          now: NOW,
          rights: {
            sourceKind: MEDIA_SOURCE_KIND.OWNED,
            rightsHolder: "Magazine Ltd",
            licenseType: MEDIA_LICENSE_TYPE.ALL_RIGHTS,
            creditLine: "Foto: Editor",
            usageRestriction: MEDIA_USAGE_RESTRICTION.NONE,
            licenseStartsAt: "2026-08-19T00:00:00.000Z",
            licenseExpiresAt: "2026-08-18T00:00:00.000Z",
          },
        }),
      (error: unknown) =>
        error instanceof MediaRightsError &&
        error.code === MEDIA_RIGHTS_ERROR.INVALID_RIGHTS,
    );

    const db = getDb();
    const [stored] = await db.select().from(media).where(eq(media.id, row.id)).limit(1);
    assert.equal(stored?.rightsHolder, null);
  });

  it("keeps published HERO on the published version and omits internal rights from the public model", async () => {
    const publishedMedia = await trackMedia(`hero-live-${randomUUID()}`);
    const draftMedia = await trackMedia(`hero-draft-${randomUUID()}`);

    await updateMediaRights({
      mediaId: publishedMedia.id,
      roles: [STAFF_ROLE.EDITOR],
      now: NOW,
      rights: {
        sourceKind: MEDIA_SOURCE_KIND.OWNED,
        rightsHolder: "Magazine Ltd",
        licenseType: MEDIA_LICENSE_TYPE.ALL_RIGHTS,
        licenseNote: "Do not leak this note",
        licenseReference: "PRIVATE-REF",
        creditLine: "Asset credit line",
        usageRestriction: MEDIA_USAGE_RESTRICTION.NONE,
      },
    });

    const created = await createContent({
      slug: `media-rights-hero-${randomUUID().slice(0, 8)}`,
      title: "Hero rights article",
      body: articleBody("hero-rights"),
      categories: primaryA(fixture),
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      media: [
        {
          mediaId: publishedMedia.id,
          role: MEDIA_ROLE.HERO,
          altText: "Published alt",
          credit: "Published credit",
        },
      ],
    });
    fixture.createdItemIds.push(created.contentItemId);

    const submitted = await submitForReview(created.contentItemId, created.versionId, {
      expectedUpdatedAt: created.updatedAt,
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
    });
    const approved = await approveVersion(created.contentItemId, created.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
    });
    await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.selectedOnA,
      fixture.ids.staffEditor,
      NOW,
    );
    void approved;

    const live = await loadPublishedHeroMedia({
      contentItemId: created.contentItemId,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(
      live?.url,
      `${MEDIA_PUBLIC_BASE_URL}/${publishedMedia.storageKey}`,
    );
    assert.equal(live?.width, 1600);
    assert.equal(live?.height, 900);
    assert.equal(live?.altText, "Published alt");
    assert.equal(live?.credit, "Published credit");
    assert.deepEqual(Object.keys(live ?? {}).sort(), [
      "altText",
      "credit",
      "height",
      "url",
      "width",
    ]);

    const revision = await createDraftRevision(
      created.contentItemId,
      undefined,
      fixture.selectedOnA,
      fixture.ids.staffEditor,
    );
    const db = getDb();
    await db
      .delete(contentVersionMedia)
      .where(eq(contentVersionMedia.contentVersionId, revision.versionId));
    await db.insert(contentVersionMedia).values({
      contentVersionId: revision.versionId,
      mediaId: draftMedia.id,
      role: MEDIA_ROLE.HERO,
      altText: "Draft alt",
      credit: "Draft credit",
    });

    const afterDraft = await loadPublishedHeroMedia({
      contentItemId: created.contentItemId,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
    });
    assert.equal(afterDraft?.url, live?.url);
    assert.equal(afterDraft?.altText, "Published alt");
    assert.equal(afterDraft?.credit, "Published credit");
  });

  it("still publishes an article whose HERO has incomplete rights", async () => {
    const hero = await trackMedia(`hero-incomplete-${randomUUID()}`);
    const created = await createContent({
      slug: `media-rights-incomplete-${randomUUID().slice(0, 8)}`,
      title: "Incomplete rights still publishable",
      body: articleBody("incomplete-rights"),
      categories: primaryA(fixture),
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      media: [
        {
          mediaId: hero.id,
          role: MEDIA_ROLE.HERO,
          altText: "Alt",
          credit: "Credit",
        },
      ],
    });
    fixture.createdItemIds.push(created.contentItemId);

    const submitted = await submitForReview(created.contentItemId, created.versionId, {
      expectedUpdatedAt: created.updatedAt,
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
    });
    const approved = await approveVersion(created.contentItemId, created.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
    });
    const published = await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.selectedOnA,
      fixture.ids.staffEditor,
      NOW,
    );
    assert.equal(published.publishedVersionId, created.versionId);
    void approved;
  });
});
