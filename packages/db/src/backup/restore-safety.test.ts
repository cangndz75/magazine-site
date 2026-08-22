import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSafeRestoreDatabaseUrl,
  inspectRestoreDatabaseUrl,
} from "./restore-safety";

describe("restore database safety", () => {
  it("allows only local databases ending in _restore_test", () => {
    const result = inspectRestoreDatabaseUrl(
      "postgresql://user:password@127.0.0.1:5432/magazine_site_restore_test",
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.databaseName, "magazine_site_restore_test");
    }
  });

  it("rejects normal development databases", () => {
    const result = inspectRestoreDatabaseUrl(
      "postgresql://user:password@127.0.0.1:5432/magazine_site",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.reason, /_restore_test/);
    }
  });

  it("rejects production-looking restore-test names", () => {
    const result = inspectRestoreDatabaseUrl(
      "postgresql://user:password@localhost:5432/magazine_production_restore_test",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.reason, /production-looking/);
    }
  });

  it("rejects unknown remote hosts", () => {
    const result = inspectRestoreDatabaseUrl(
      "postgresql://user:password@db.example.com:5432/magazine_site_restore_test",
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.reason, /local/);
    }
  });

  it("throws a clear error for unsafe destinations", () => {
    assert.throws(
      () => assertSafeRestoreDatabaseUrl("postgresql://user:password@localhost:5432/app"),
      /Unsafe restore destination/,
    );
  });
});
