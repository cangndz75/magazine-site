import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLICATION_STATUS } from "../publication-status";
import { PUBLISHING_ERROR } from "../publishing/errors";
import { decideChangeContentSlug, slugAdvisoryLockKeys } from "../publishing/slug-change";
import {
  canRedirectHistoricalPublicSlug,
  decideHistoricalSlugLookupKey,
} from "./slug-redirect";

const token = new Date("2026-03-01T10:00:00.000Z");

describe("slug history and public redirect authority", () => {
  it("plans a slug change only with a matching expectedUpdatedAt token", () => {
    const planned = decideChangeContentSlug({
      requestedSlug: "yeni-slug",
      currentSlug: "eski-slug",
      currentUpdatedAt: token,
      expectedUpdatedAt: token,
      deletedAt: null,
      legalHoldAt: null,
    });
    assert.equal(planned.ok, true);
    if (planned.ok) {
      assert.deepEqual(planned.value, {
        previousSlug: "eski-slug",
        nextSlug: "yeni-slug",
        unchanged: false,
      });
    }

    const stale = decideChangeContentSlug({
      requestedSlug: "yeni-slug",
      currentSlug: "eski-slug",
      currentUpdatedAt: token,
      expectedUpdatedAt: new Date("2026-03-01T09:00:00.000Z"),
      deletedAt: null,
    });
    assert.equal(stale.ok, false);
    if (!stale.ok) {
      assert.equal(stale.code, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
    }
  });

  it("rejects invalid slugs and treats identical canonical slugs as a no-op plan", () => {
    const invalid = decideChangeContentSlug({
      requestedSlug: "Hello World",
      currentSlug: "eski-slug",
      currentUpdatedAt: token,
      expectedUpdatedAt: token,
      deletedAt: null,
    });
    assert.equal(invalid.ok, false);
    if (!invalid.ok) {
      assert.equal(invalid.code, PUBLISHING_ERROR.INVALID_SLUG);
    }

    const unchanged = decideChangeContentSlug({
      requestedSlug: "Ayni-Slug",
      currentSlug: "ayni-slug",
      currentUpdatedAt: token,
      expectedUpdatedAt: token,
      deletedAt: null,
    });
    assert.equal(unchanged.ok, true);
    if (unchanged.ok) {
      assert.equal(unchanged.value.unchanged, true);
    }
  });

  it("locks slug keys in deterministic order so A→B and B→A cannot deadlock", () => {
    assert.deepEqual(slugAdvisoryLockKeys("beta", "alpha"), ["alpha", "beta"]);
    assert.deepEqual(slugAdvisoryLockKeys("alpha", "alpha"), ["alpha"]);
  });

  it("redirects historical slugs only for publicly authoritative published items", () => {
    const live = {
      publicationStatus: PUBLICATION_STATUS.PUBLISHED,
      publishedVersionId: "11111111-1111-4111-8111-111111111111",
      publishedAt: token,
      deletedAt: null,
    };
    assert.equal(canRedirectHistoricalPublicSlug(live), true);
    assert.equal(
      canRedirectHistoricalPublicSlug({
        ...live,
        publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
      }),
      false,
    );
    assert.equal(
      canRedirectHistoricalPublicSlug({
        ...live,
        publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
        publishedVersionId: null,
        publishedAt: null,
      }),
      false,
    );
    assert.equal(
      canRedirectHistoricalPublicSlug({
        ...live,
        deletedAt: token,
      }),
      false,
    );
    assert.equal(decideHistoricalSlugLookupKey("Eski-Slug"), "eski-slug");
    assert.equal(decideHistoricalSlugLookupKey("../login"), null);
  });
});
