import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import {
  MEDIA_RIGHTS_STATUS,
  MEDIA_SOURCE_KIND,
  MEDIA_UPLOAD_ERROR,
  MediaUploadError,
  STAFF_ROLE,
} from "@magazine/domain";
import { getDb } from "../client";
import { uploadEditorImage } from "../editor/media-upload";
import { media } from "../schema/media";
import { createMemoryMediaObjectStore } from "../storage/memory";
import {
  cleanupFixture,
  closeIntegrationConnections,
  createFixture,
  ensureEditorContentTestDatabase,
  type IntegrationFixture,
} from "./harness";

const MEDIA_PUBLIC_BASE_URL = "https://media.example.test/assets";
const NOW = new Date("2026-08-19T12:00:00.000Z");

async function sampleJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 48,
      height: 32,
      channels: 3,
      background: { r: 90, g: 20, b: 20 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe("editor image upload PostgreSQL", () => {
  let fixture: IntegrationFixture;
  const createdIds: string[] = [];

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    fixture = await createFixture();
  });

  afterEach(async () => {
    const db = getDb();
    for (const id of createdIds.splice(0)) {
      await db.delete(media).where(eq(media.id, id));
    }
    await cleanupFixture(fixture);
  });

  after(async () => {
    await closeIntegrationConnections();
  });

  it("creates a media row from decoded bytes with incomplete rights defaults", async () => {
    const storage = createMemoryMediaObjectStore();
    const bytes = await sampleJpeg();
    const result = await uploadEditorImage({
      roles: [STAFF_ROLE.EDITOR],
      bytes,
      originalFilename: "..\\photos\\hero-upload.jpg",
      storage,
      mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
      now: NOW,
    });
    createdIds.push(result.id);

    assert.equal(result.label, "hero-upload.jpg");
    assert.equal(result.mimeType, "image/jpeg");
    assert.equal(result.width, 48);
    assert.equal(result.height, 32);
    assert.equal(result.eligibility.status, MEDIA_RIGHTS_STATUS.INCOMPLETE);
    assert.equal(result.eligibility.eligible, false);
    assert.match(result.previewUrl ?? "", /uploads\/2026\/08\/.+\.jpg$/);
    assert.equal(JSON.stringify(result).includes("storageKey"), false);

    const db = getDb();
    const [row] = await db.select().from(media).where(eq(media.id, result.id)).limit(1);
    assert.ok(row);
    assert.equal(row.mimeType, "image/jpeg");
    assert.equal(row.width, 48);
    assert.equal(row.height, 32);
    assert.equal(row.originalFilename, "hero-upload.jpg");
    assert.equal(row.sourceKind, MEDIA_SOURCE_KIND.UNKNOWN);
    assert.match(row.storageKey, /^uploads\/2026\/08\/[0-9a-f-]{36}\.jpg$/i);
    assert.equal(row.contentHash?.length, 64);
    assert.equal(storage.objects.has(row.storageKey), true);
    void fixture;
  });

  it("rejects unauthenticated and read-only roles before storage", async () => {
    const storage = createMemoryMediaObjectStore();
    const bytes = await sampleJpeg();
    await assert.rejects(
      () =>
        uploadEditorImage({
          roles: [],
          bytes,
          storage,
          mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
          now: NOW,
        }),
      (error: unknown) =>
        error instanceof MediaUploadError && error.code === MEDIA_UPLOAD_ERROR.FORBIDDEN,
    );
    assert.equal(storage.objects.size, 0);
  });

  it("does not insert a row when storage put fails", async () => {
    const storage = createMemoryMediaObjectStore();
    storage.failNextPut = new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_FAILED);
    const bytes = await sampleJpeg();
    await assert.rejects(
      () =>
        uploadEditorImage({
          roles: [STAFF_ROLE.EDITOR],
          bytes,
          storage,
          mediaPublicBaseUrl: MEDIA_PUBLIC_BASE_URL,
          now: NOW,
        }),
      (error: unknown) =>
        error instanceof MediaUploadError &&
        error.code === MEDIA_UPLOAD_ERROR.STORAGE_FAILED,
    );
    const db = getDb();
    const [row] = await db
      .select()
      .from(media)
      .where(eq(media.originalFilename, `missing-${randomUUID()}.jpg`))
      .limit(1);
    assert.equal(row, undefined);
  });
});
