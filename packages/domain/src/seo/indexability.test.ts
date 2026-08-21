import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLICATION_STATUS } from "../publication-status";
import {
  PUBLIC_INDEXABILITY_REASON,
  isPublicSitemapEligible,
  resolveMissingPublicArticleIndexability,
  resolvePublicIndexability,
  resolveWithdrawnArticleIndexability,
  robotsMetadataForIndexability,
} from "./indexability";
import { PUBLIC_ARTICLE_WITHDRAWAL_KIND } from "../public-legal";

const published = {
  publicationStatus: PUBLICATION_STATUS.PUBLISHED,
  publishedVersionId: "11111111-1111-4111-8111-111111111111",
  publishedAt: new Date("2026-03-01T10:00:00.000Z"),
  deletedAt: null,
  retractedAt: null,
  takedownAt: null,
} as const;

describe("public indexability contract", () => {
  it("indexes a normal published article with publishedVersion authority", () => {
    const decision = resolvePublicIndexability(published);
    assert.equal(decision.indexable, true);
    assert.equal(decision.reason, PUBLIC_INDEXABILITY_REASON.INDEXABLE);
    assert.deepEqual(decision.robots, { index: true, follow: true });
    assert.deepEqual(robotsMetadataForIndexability(decision), {
      index: true,
      follow: true,
      "max-image-preview": "large",
    });
    assert.equal(isPublicSitemapEligible(published), true);
  });

  it("keeps correction and clarification indexable because they are not withdrawals", () => {
    const decision = resolvePublicIndexability(published);
    assert.equal(decision.indexable, true);
    assert.equal(isPublicSitemapEligible(published), true);
  });

  it("never indexes drafts, scheduled-only items, or ordinary unpublished articles", () => {
    const draft = resolvePublicIndexability({
      ...published,
      publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
      publishedVersionId: null,
      publishedAt: null,
    });
    assert.equal(draft.indexable, false);
    assert.equal(
      draft.reason,
      PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_NEVER_PUBLISHED,
    );

    const scheduledOnly = resolvePublicIndexability({
      publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
      publishedVersionId: null,
      publishedAt: null,
      deletedAt: null,
      retractedAt: null,
      takedownAt: null,
    });
    assert.equal(scheduledOnly.indexable, false);
    assert.equal(
      isPublicSitemapEligible({
        publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
        publishedVersionId: null,
        publishedAt: null,
        deletedAt: null,
        retractedAt: null,
        takedownAt: null,
      }),
      false,
    );

    const unpublished = resolvePublicIndexability({
      ...published,
      publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
    });
    assert.equal(unpublished.indexable, false);
    assert.equal(
      unpublished.reason,
      PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_UNPUBLISHED,
    );
    assert.deepEqual(robotsMetadataForIndexability(unpublished), {
      index: false,
      follow: false,
    });
  });

  it("noindexes retraction and takedown even when publicationStatus remains PUBLISHED", () => {
    const retracted = resolvePublicIndexability({
      ...published,
      retractedAt: new Date("2026-03-05T12:00:00.000Z"),
    });
    assert.equal(retracted.indexable, false);
    assert.equal(
      retracted.reason,
      PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_RETRACTION,
    );

    const takedown = resolvePublicIndexability({
      ...published,
      takedownAt: new Date("2026-03-06T12:00:00.000Z"),
    });
    assert.equal(takedown.indexable, false);
    assert.equal(
      takedown.reason,
      PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_TAKEDOWN,
    );

    const retractedShell = resolveWithdrawnArticleIndexability(
      PUBLIC_ARTICLE_WITHDRAWAL_KIND.RETRACTION,
    );
    const takedownShell = resolveWithdrawnArticleIndexability(
      PUBLIC_ARTICLE_WITHDRAWAL_KIND.TAKEDOWN,
    );
    assert.equal(retractedShell.reason, retracted.reason);
    assert.equal(takedownShell.reason, takedown.reason);
  });

  it("prefers takedown over retraction and deleted over both", () => {
    const both = resolvePublicIndexability({
      ...published,
      retractedAt: new Date("2026-03-05T12:00:00.000Z"),
      takedownAt: new Date("2026-03-06T12:00:00.000Z"),
    });
    assert.equal(both.reason, PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_TAKEDOWN);

    const deleted = resolvePublicIndexability({
      ...published,
      deletedAt: new Date("2026-03-07T12:00:00.000Z"),
      takedownAt: new Date("2026-03-06T12:00:00.000Z"),
    });
    assert.equal(deleted.reason, PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_DELETED);
  });

  it("does not treat a preserved publishedVersionId on unpublished items as public authority", () => {
    const decision = resolvePublicIndexability({
      publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
      publishedVersionId: published.publishedVersionId,
      publishedAt: published.publishedAt,
      deletedAt: null,
      retractedAt: null,
      takedownAt: null,
    });
    assert.equal(decision.indexable, false);
    assert.equal(
      decision.reason,
      PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_UNPUBLISHED,
    );
  });

  it("noindexes missing public articles without a canonical identity", () => {
    const missing = resolveMissingPublicArticleIndexability();
    assert.equal(missing.indexable, false);
    assert.equal(
      missing.reason,
      PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_NOT_FOUND,
    );
  });

  it("lets an editor robots override restrict an indexable article but never force index", () => {
    const restricted = resolvePublicIndexability({
      ...published,
      storedRobots: "noindex,follow",
    });
    assert.equal(restricted.indexable, false);
    assert.equal(
      restricted.reason,
      PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_ROBOTS_OVERRIDE,
    );
    assert.equal(isPublicSitemapEligible({ ...published, storedRobots: "none" }), false);

    const withdrawn = resolvePublicIndexability({
      ...published,
      retractedAt: new Date("2026-03-05T12:00:00.000Z"),
      storedRobots: "index,follow",
    });
    assert.equal(withdrawn.indexable, false);
    assert.equal(
      withdrawn.reason,
      PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_RETRACTION,
    );

    const unpublished = resolvePublicIndexability({
      ...published,
      publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
      storedRobots: "index",
    });
    assert.equal(unpublished.indexable, false);
    assert.equal(
      unpublished.reason,
      PUBLIC_INDEXABILITY_REASON.NOT_INDEXABLE_UNPUBLISHED,
    );
  });
});
