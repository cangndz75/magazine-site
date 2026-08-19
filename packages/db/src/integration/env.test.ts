import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EDITOR_CONTENT_TEST_DATABASE_URL_ENV,
  UnsafeTestDatabaseError,
  parseEditorContentTestDatabaseUrl,
} from "./env";

describe("editor content test database safety", () => {
  it("refuses to run without the dedicated test URL", () => {
    assert.throws(
      () => parseEditorContentTestDatabaseUrl(undefined, { APP_ENV: "development" }),
      (error: unknown) =>
        error instanceof UnsafeTestDatabaseError &&
        error.message.includes(EDITOR_CONTENT_TEST_DATABASE_URL_ENV),
    );
  });

  it("does not fall back to DATABASE_URL", () => {
    assert.throws(
      () =>
        parseEditorContentTestDatabaseUrl("", {
          APP_ENV: "development",
          DATABASE_URL: "postgresql://user:password@127.0.0.1:5432/magazine_site_test",
        }),
      UnsafeTestDatabaseError,
    );
  });

  it("refuses production and staging APP_ENV even with a local *_test URL", () => {
    const localTest =
      "postgresql://user:password@127.0.0.1:5432/magazine_site_content_test";
    assert.throws(
      () => parseEditorContentTestDatabaseUrl(localTest, { APP_ENV: "production" }),
      UnsafeTestDatabaseError,
    );
    assert.throws(
      () => parseEditorContentTestDatabaseUrl(localTest, { APP_ENV: "staging" }),
      UnsafeTestDatabaseError,
    );
  });

  it("refuses non-loopback hosts", () => {
    assert.throws(
      () =>
        parseEditorContentTestDatabaseUrl(
          "postgresql://user:password@db.internal.example:5432/magazine_site_content_test",
          { APP_ENV: "development" },
        ),
      UnsafeTestDatabaseError,
    );
  });

  it("refuses the normal application database name", () => {
    assert.throws(
      () =>
        parseEditorContentTestDatabaseUrl(
          "postgresql://user:password@127.0.0.1:5432/magazine_site",
          { APP_ENV: "development" },
        ),
      UnsafeTestDatabaseError,
    );
  });

  it("accepts a loopback database whose name ends with _test", () => {
    const parsed = parseEditorContentTestDatabaseUrl(
      "postgresql://user:password@localhost:5432/magazine_site_content_test",
      { APP_ENV: "development" },
    );
    assert.equal(parsed.host, "localhost");
    assert.equal(parsed.database, "magazine_site_content_test");
  });
});
