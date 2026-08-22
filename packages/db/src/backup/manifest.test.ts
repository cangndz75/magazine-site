import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertManifestHasNoSecrets,
  buildBackupManifest,
  serializeBackupManifest,
} from "./manifest";

function manifest() {
  return buildBackupManifest({
    createdAt: "2026-08-22T12:00:00.000Z",
    applicationRevision: "abc123",
    databaseFilename: "magazine-db.dump",
    databaseSha256: "a".repeat(64),
    journalVersion: "7",
    latestMigration: { idx: 23, tag: "0024_photo-gallery-content-kind" },
    mediaInventory: {
      storageMode: "s3",
      bucketIdentifier: "magazine-media",
      assetCount: 12,
      referencedObjectCount: 8,
      renditionCount: 24,
      missingReferenceCount: 0,
    },
  });
}

describe("backup manifest", () => {
  it("serializes deterministically", () => {
    const first = serializeBackupManifest(manifest());
    const second = serializeBackupManifest(manifest());
    assert.equal(first, second);
    assert.match(first, /"format": "magazine.backup.manifest"/);
  });

  it("does not serialize database URLs or credential fields", () => {
    const serialized = serializeBackupManifest(manifest());
    assert.equal(serialized.includes("DATABASE_URL"), false);
    assert.equal(serialized.includes("postgresql://"), false);
    assert.equal(serialized.includes("password"), false);
    assert.equal(serialized.includes("secret"), false);
  });

  it("rejects forbidden credential-looking fields", () => {
    assert.throws(
      () =>
        assertManifestHasNoSecrets({
          databaseUrl: "postgresql://user:password@localhost:5432/app",
        }),
      /forbidden field/,
    );
  });

  it("rejects credential-looking string values", () => {
    assert.throws(
      () =>
        assertManifestHasNoSecrets({
          database: "postgresql://user:password@localhost:5432/app",
        }),
      /credential-looking value/,
    );
  });
});
