import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import {
  MEDIA_RIGHTS_STATUS,
  MEDIA_ROLE,
  MEDIA_TYPE,
  STAFF_ROLE,
} from "@magazine/domain";
import {
  EDITOR_MEDIA_SORT,
  listEditorMedia,
  parseEditorMediaPageSize,
  parseEditorMediaSearch,
} from "../editor/media-library";
import { updateMediaRights } from "../editor/media-rights";
import { createContent } from "../publishing";
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

describe("editor media library PostgreSQL", () => {
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

  it("lists media with search, pagination, and bounded page size", async () => {
    const alpha = await insertLegacyMedia(`itest/media-rights-alpha-${randomUUID()}.jpg`);
    const beta = await insertLegacyMedia(`itest/media-rights-beta-${randomUUID()}.jpg`);
    await updateMediaRights({
      mediaId: beta.id,
      roles: [STAFF_ROLE.EDITOR],
      rights: {
        sourceKind: "OWNED",
        licenseType: "ALL_RIGHTS",
        usageRestriction: "NONE",
        rightsHolder: "Magazin",
        creditLine: "Foto: Beta",
        creatorName: "Beta Photographer",
      },
      now: NOW,
    });

    const firstPage = await listEditorMedia({
      roles: [STAFF_ROLE.EDITOR],
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      q: "itest/media-rights-",
      sort: EDITOR_MEDIA_SORT.FILENAME_ASC,
      pageSize: "1",
      now: NOW,
    });
    assert.equal(firstPage.items.length, 1);
    assert.ok(firstPage.totalCount >= 2);
    assert.ok(firstPage.nextCursor);

    const secondPage = await listEditorMedia({
      roles: [STAFF_ROLE.EDITOR],
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      q: "itest/media-rights-",
      sort: EDITOR_MEDIA_SORT.FILENAME_ASC,
      pageSize: "1",
      cursor: firstPage.nextCursor,
      now: NOW,
    });
    assert.equal(secondPage.items.length, 1);
    assert.notEqual(firstPage.items[0].id, secondPage.items[0].id);
    const firstIds = new Set(firstPage.items.map((item) => item.id));
    for (const item of secondPage.items) {
      assert.equal(firstIds.has(item.id), false);
    }

    const invalidCursorPage = await listEditorMedia({
      roles: [STAFF_ROLE.EDITOR],
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      q: "itest/media-rights-",
      sort: EDITOR_MEDIA_SORT.FILENAME_ASC,
      pageSize: "1",
      cursor: "not-a-valid-cursor",
      now: NOW,
    });
    assert.equal(invalidCursorPage.items.length, 1);
    assert.equal(invalidCursorPage.items[0].id, firstPage.items[0].id);

    const search = await listEditorMedia({
      roles: [STAFF_ROLE.EDITOR],
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      q: "Beta Photographer",
      now: NOW,
    });
    assert.equal(search.items.length, 1);
    assert.equal(search.items[0].id, beta.id);
    assert.equal(
      search.items[0].previewUrl,
      `${MEDIA_PUBLIC_BASE_URL}/${beta.storageKey}`,
    );

    assert.equal(parseEditorMediaPageSize("999"), 48);
    assert.equal(parseEditorMediaSearch("  hello  "), "hello");
    void alpha;
  });

  it("filters by rights status and usage", async () => {
    const unused = await insertLegacyMedia(`itest/media-rights-unused-${randomUUID()}.jpg`);
    const used = await insertLegacyMedia(`itest/media-rights-used-${randomUUID()}.jpg`);
    const created = await createContent({
      slug: `media-rights-${randomUUID().slice(0, 8)}`,
      title: "Usage article",
      body: articleBody("usage"),
      categories: primaryA(fixture),
      scope: fixture.selectedOnA,
      actorId: fixture.ids.staffEditor,
      media: [
        {
          mediaId: used.id,
          role: MEDIA_ROLE.HERO,
          altText: null,
          credit: null,
        },
      ],
    });
    fixture.createdItemIds.push(created.contentItemId);

    const incomplete = await listEditorMedia({
      roles: [STAFF_ROLE.EDITOR],
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      rightsStatus: MEDIA_RIGHTS_STATUS.INCOMPLETE,
      now: NOW,
    });
    assert.ok(incomplete.items.some((item) => item.id === unused.id));

    const usedOnly = await listEditorMedia({
      roles: [STAFF_ROLE.EDITOR],
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      used: true,
      q: "itest/media-rights-used-",
      now: NOW,
    });
    assert.equal(usedOnly.items.length, 1);
    assert.equal(usedOnly.items[0].id, used.id);
    assert.equal(usedOnly.items[0].usageCount, 1);

    const missingAlt = await listEditorMedia({
      roles: [STAFF_ROLE.EDITOR],
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      missingAltText: true,
      q: "itest/media-rights-used-",
      now: NOW,
    });
    assert.ok(missingAlt.items.some((item) => item.id === used.id));
    void unused;
  });

  it("filters by media type", async () => {
    await insertLegacyMedia(`itest/media-rights-type-${randomUUID()}.jpg`);
    const result = await listEditorMedia({
      roles: [STAFF_ROLE.EDITOR],
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      mediaType: MEDIA_TYPE.IMAGE,
      q: "itest/media-rights-type-",
      now: NOW,
    });
    assert.ok(result.items.length >= 1);
    assert.ok(result.items.every((item) => item.mediaType === MEDIA_TYPE.IMAGE));
  });
});
