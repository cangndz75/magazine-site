import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTHOR_ROLES } from "./author-role";
import { CREDIBILITY, CREDIBILITY_VALUES } from "./credibility";
import { ENTITY_ROLES } from "./entity-role";
import { MEDIA_ROLES } from "./media-role";
import {
  PRIMARY_CATEGORY_ISSUE,
  assertPublishablePrimaryCategory,
} from "./primary-category";
import {
  PUBLICATION_STATUS,
  PUBLICATION_STATUSES,
} from "./publication-status";
import {
  isStaleScheduleGeneration,
  shouldExecuteScheduledPublish,
} from "./schedule-generation";
import {
  publicPublishedVersionId,
  publishedStateIsCoherent,
  versionPointersAreSeparated,
} from "./content-item-invariants";
import {
  parsePublicArticleCacheInvalidatePayload,
  publicArticleInvalidationTags,
  publicArticleSlugCacheTag,
  publicContentCacheTag,
} from "./public-cache";
import { WORKFLOW_STATUS, WORKFLOW_STATUSES } from "./workflow-status";

describe("publication and workflow axes", () => {
  it("keeps publication status separate from editorial workflow status", () => {
    const publication = new Set<string>(PUBLICATION_STATUSES);
    const workflow = new Set<string>(WORKFLOW_STATUSES);

    assert.deepEqual([...publication], [
      PUBLICATION_STATUS.NEVER_PUBLISHED,
      PUBLICATION_STATUS.PUBLISHED,
      PUBLICATION_STATUS.UNPUBLISHED,
    ]);
    assert.deepEqual([...workflow], [
      WORKFLOW_STATUS.DRAFT,
      WORKFLOW_STATUS.IN_REVIEW,
      WORKFLOW_STATUS.APPROVED,
    ]);

    for (const status of publication) {
      assert.equal(workflow.has(status), false);
    }
  });

  it("does not treat UPDATED as a credibility value", () => {
    assert.deepEqual([...CREDIBILITY_VALUES], [
      CREDIBILITY.CLAIM,
      CREDIBILITY.CONFIRMED,
      CREDIBILITY.DENIED,
    ]);
    assert.equal(
      (CREDIBILITY_VALUES as readonly string[]).includes("UPDATED"),
      false,
    );
  });

  it("locks versioned relation roles", () => {
    assert.deepEqual([...ENTITY_ROLES], ["SUBJECT", "SECONDARY", "MENTIONED"]);
    assert.deepEqual([...MEDIA_ROLES], ["HERO", "INLINE", "GALLERY"]);
    assert.deepEqual([...AUTHOR_ROLES], ["AUTHOR", "CONTRIBUTOR"]);
  });
});

describe("publishable primary category", () => {
  it("rejects zero primary categories", () => {
    const result = assertPublishablePrimaryCategory([
      { isPrimary: false },
      { isPrimary: false },
    ]);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.issue, PRIMARY_CATEGORY_ISSUE.REQUIRED);
    }
  });

  it("rejects multiple primary categories", () => {
    const result = assertPublishablePrimaryCategory([
      { isPrimary: true },
      { isPrimary: true },
    ]);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.issue, PRIMARY_CATEGORY_ISSUE.MULTIPLE);
    }
  });

  it("accepts exactly one primary category", () => {
    const result = assertPublishablePrimaryCategory([
      { isPrimary: false },
      { isPrimary: true },
      { isPrimary: false },
    ]);

    assert.deepEqual(result, { ok: true });
  });
});

describe("schedule generation", () => {
  it("treats a mismatched generation as stale and not executable", () => {
    assert.equal(isStaleScheduleGeneration(3, 4), true);
    assert.equal(
      shouldExecuteScheduledPublish({ scheduleGeneration: 3 }, 4),
      false,
    );
  });

  it("treats a matching generation as current and executable", () => {
    assert.equal(isStaleScheduleGeneration(4, 4), false);
    assert.equal(
      shouldExecuteScheduledPublish({ scheduleGeneration: 4 }, 4),
      true,
    );
  });
});

describe("content item version pointers", () => {
  it("allows null pointers and distinct published/draft versions", () => {
    assert.equal(
      versionPointersAreSeparated({
        publishedVersionId: null,
        draftVersionId: null,
        scheduledVersionId: null,
      }),
      true,
    );
    assert.equal(
      versionPointersAreSeparated({
        publishedVersionId: "v7",
        draftVersionId: null,
        scheduledVersionId: null,
      }),
      true,
    );
    assert.equal(
      versionPointersAreSeparated({
        publishedVersionId: "v7",
        draftVersionId: "v8",
        scheduledVersionId: null,
      }),
      true,
    );
  });

  it("rejects the same version occupying two active pointer roles", () => {
    assert.equal(
      versionPointersAreSeparated({
        publishedVersionId: "v7",
        draftVersionId: "v7",
        scheduledVersionId: null,
      }),
      false,
    );
    assert.equal(
      versionPointersAreSeparated({
        publishedVersionId: null,
        draftVersionId: "v8",
        scheduledVersionId: "v8",
      }),
      false,
    );
    assert.equal(
      versionPointersAreSeparated({
        publishedVersionId: "v7",
        draftVersionId: null,
        scheduledVersionId: "v7",
      }),
      false,
    );
  });
});

describe("published state coherence", () => {
  it("requires publication data when status is PUBLISHED", () => {
    assert.equal(
      publishedStateIsCoherent({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: null,
        publishedAt: null,
      }),
      false,
    );
    assert.equal(
      publishedStateIsCoherent({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: "v7",
        publishedAt: "2026-08-16T00:00:00.000Z",
      }),
      true,
    );
  });

  it("does not require UNPUBLISHED to clear historical publication data", () => {
    assert.equal(
      publishedStateIsCoherent({
        publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
        publishedVersionId: "v7",
        publishedAt: "2026-08-16T00:00:00.000Z",
      }),
      true,
    );
  });
});

describe("public published version resolution", () => {
  it("exposes the published version only while publicationStatus is PUBLISHED", () => {
    assert.equal(
      publicPublishedVersionId({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: "v7",
      }),
      "v7",
    );
  });

  it("does not treat a preserved publishedVersionId as publicly live after unpublish", () => {
    assert.equal(
      publicPublishedVersionId({
        publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
        publishedVersionId: "v7",
      }),
      null,
    );
    assert.equal(
      publicPublishedVersionId({
        publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
        publishedVersionId: null,
      }),
      null,
    );
  });

  it("does not resolve deleted items as public", () => {
    assert.equal(
      publicPublishedVersionId({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: "v7",
        deletedAt: "2026-08-18T00:00:00.000Z",
      }),
      null,
    );
  });
});

describe("public cache tags", () => {
  it("builds deterministic article slug and content tags", () => {
    assert.equal(
      publicArticleSlugCacheTag("kanonik-haber"),
      "article-slug:kanonik-haber",
    );
    assert.equal(publicArticleSlugCacheTag("Hello World"), null);
    assert.equal(
      publicContentCacheTag("11111111-1111-4111-8111-111111111111"),
      "content:11111111-1111-4111-8111-111111111111",
    );
    assert.deepEqual(
      publicArticleInvalidationTags({
        contentItemId: "11111111-1111-4111-8111-111111111111",
        slug: "kanonik-haber",
      }),
      [
        "content:11111111-1111-4111-8111-111111111111",
        "article-slug:kanonik-haber",
      ],
    );
  });

  it("accepts only the versioned public cache invalidation payload", () => {
    assert.deepEqual(
      parsePublicArticleCacheInvalidatePayload({
        schemaVersion: 1,
        contentItemId: "11111111-1111-4111-8111-111111111111",
        slug: "kanonik-haber",
      }),
      {
        ok: true,
        value: {
          schemaVersion: 1,
          contentItemId: "11111111-1111-4111-8111-111111111111",
          slug: "kanonik-haber",
        },
      },
    );

    for (const body of [
      null,
      [],
      { schemaVersion: 2, contentItemId: "11111111-1111-4111-8111-111111111111", slug: "kanonik-haber" },
      { schemaVersion: 1, contentItemId: "not-a-uuid", slug: "kanonik-haber" },
      { schemaVersion: 1, contentItemId: "11111111-1111-4111-8111-111111111111" },
      {
        schemaVersion: 1,
        contentItemId: "11111111-1111-4111-8111-111111111111",
        slug: "kanonik-haber",
        tags: ["article-slug:kanonik-haber"],
      },
    ]) {
      assert.deepEqual(parsePublicArticleCacheInvalidatePayload(body), {
        ok: false,
      });
    }
  });
});
