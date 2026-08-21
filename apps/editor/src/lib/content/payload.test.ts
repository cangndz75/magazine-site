import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_LIST_MAX_LIMIT, PUBLISHING_ERROR, STAFF_ROLE, STAFF_SCOPE_MODE } from "@magazine/domain";
import { parseEditorListSearchParams, parseReviewQueueSearchParams, parseRevisionHistorySearchParams, parseDiffSearchParams } from "./list-params";
import { parseArticleEditorSaveBody, parseContentSlugBody, parseCreateContentBody, parseDraftGalleryBody, parseDraftHeroBody, parseDraftSaveBody, parseRequestChangesBody, parseRevisionBody, parseScheduleBody, parseSubmitReviewBody } from "./payload";

const CAT = "11111111-1111-4111-8111-111111111111";
const VER = "22222222-2222-4222-8222-222222222222";

describe("editor list query parsing", () => {
  it("clamps abusive page size", () => {
    const parsed = parseEditorListSearchParams(
      new URL("https://editor.example/api/content?limit=5000"),
    );
    assert.equal(parsed.limit, EDITOR_LIST_MAX_LIMIT);
  });

  it("rejects an invalid cursor", () => {
    assert.throws(() =>
      parseEditorListSearchParams(
        new URL("https://editor.example/api/content?cursor=not-a-cursor"),
      ),
    );
  });

  it("rejects a malformed revision-history cursor and clamps limit", () => {
    assert.throws(() =>
      parseRevisionHistorySearchParams(
        new URL("https://editor.example/api/content/x/revisions?cursor=nope"),
      ),
    );
    const parsed = parseRevisionHistorySearchParams(
      new URL("https://editor.example/api/content/x/revisions?limit=5000"),
    );
    assert.equal(parsed.limit, EDITOR_LIST_MAX_LIMIT);
  });

  it("requires two valid version UUIDs for semantic diff", () => {
    assert.throws(() =>
      parseDiffSearchParams(
        new URL("https://editor.example/api/content/x/diff"),
      ),
    );
    assert.throws(() =>
      parseDiffSearchParams(
        new URL(
          "https://editor.example/api/content/x/diff?fromVersionId=not-a-uuid&toVersionId=22222222-2222-4222-8222-222222222222",
        ),
      ),
    );
    const parsed = parseDiffSearchParams(
      new URL(
        "https://editor.example/api/content/x/diff?fromVersionId=11111111-1111-4111-8111-111111111111&toVersionId=22222222-2222-4222-8222-222222222222",
      ),
    );
    assert.equal(parsed.fromVersionId, "11111111-1111-4111-8111-111111111111");
    assert.equal(parsed.toVersionId, "22222222-2222-4222-8222-222222222222");
  });

  it("rejects a list cursor on the review queue and ignores workflowStatus", () => {
    assert.throws(() =>
      parseReviewQueueSearchParams(
        new URL("https://editor.example/api/review-queue?cursor=not-a-cursor"),
      ),
    );
    const parsed = parseReviewQueueSearchParams(
      new URL(
        "https://editor.example/api/review-queue?workflowStatus=DRAFT&limit=2",
      ),
    );
    assert.equal("workflowStatus" in parsed, false);
    assert.equal(parsed.limit, 2);
  });
});

describe("create/draft payload validation", () => {
  it("rejects invalid create JSON", () => {
    assert.throws(() =>
      parseCreateContentBody(
        { slug: "hello" },
        {
          roles: [STAFF_ROLE.EDITOR],
          scopeMode: STAFF_SCOPE_MODE.ALL,
          scopedCategoryIds: [],
        },
      ),
    );
  });

  it("requires a primary category for SELECTED create", () => {
    try {
      parseCreateContentBody(
        { title: "Hello", slug: "hello" },
        {
          roles: [STAFF_ROLE.AUTHOR],
          scopeMode: STAFF_SCOPE_MODE.SELECTED,
          scopedCategoryIds: [CAT],
        },
      );
      assert.fail("expected throw");
    } catch (error) {
      assert.equal(
        error instanceof Error && "code" in error
          ? (error as { code: string }).code
          : null,
        PUBLISHING_ERROR.SELECTED_SCOPE_PRIMARY_REQUIRED,
      );
    }
  });

  it("ignores client workflowStatus on draft save", () => {
    const parsed = parseDraftSaveBody({
      versionId: VER,
      expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
      title: "Hello",
      body: { blocks: [] },
      workflowStatus: "APPROVED",
      categories: [],
      tags: [],
      entities: [],
      media: [],
      authors: [],
    });
    assert.equal("workflowStatus" in parsed, false);
    assert.equal(parsed.title, "Hello");
  });

  it("ignores client-supplied staff identity fields", () => {
    const parsed = parseCreateContentBody(
      {
        title: "Hello",
        slug: "hello-world",
        staffUserId: "attacker",
        scopeMode: "ALL",
        scopedCategoryIds: ["x"],
      },
      {
        roles: [STAFF_ROLE.EDITOR],
        scopeMode: STAFF_SCOPE_MODE.ALL,
        scopedCategoryIds: [],
      },
    );
    assert.equal(parsed.title, "Hello");
    assert.equal("staffUserId" in parsed, false);
  });

  it("accepts canonical structured body on article editor saves", () => {
    const parsed = parseArticleEditorSaveBody({
      versionId: VER,
      expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
      title: "Hello",
      body: { blocks: [{ type: "paragraph", text: "Gövde" }] },
      categories: [],
      tags: [],
      entities: [],
      media: [],
      authors: [],
    });
    assert.deepEqual(parsed.body, {
      blocks: [{ type: "paragraph", text: "Gövde" }],
    });
    assert.deepEqual(parsed.categories, []);
  });

  it("requires version-owned relations on article editor saves", () => {
    assert.throws(() =>
      parseArticleEditorSaveBody({
        versionId: VER,
        expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
        title: "Hello",
        body: { blocks: [] },
      }),
    );
  });

  it("ignores client workflowStatus on article editor saves", () => {
    const parsed = parseArticleEditorSaveBody({
      versionId: VER,
      expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
      title: "Hello",
      body: { blocks: [] },
      workflowStatus: "APPROVED",
      publicationStatus: "PUBLISHED",
      categories: [{ categoryId: CAT, isPrimary: true }],
      tags: [],
      entities: [],
      media: [],
      authors: [],
    });
    assert.equal("workflowStatus" in parsed, false);
    assert.equal("publicationStatus" in parsed, false);
    assert.equal(parsed.categories[0]?.categoryId, CAT);
  });

  it("accepts draft SEO fields with expectedUpdatedAt and supported robots restriction", () => {
    const parsed = parseArticleEditorSaveBody({
      versionId: VER,
      expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
      title: "Hello",
      seoTitle: "SEO başlığı",
      seoDescription: "SEO açıklaması",
      canonicalUrl: "https://www.example.com/hello",
      robots: "noindex",
      body: { blocks: [] },
      categories: [{ categoryId: CAT, isPrimary: true }],
      tags: [],
      entities: [],
      media: [],
      authors: [],
    });
    assert.equal(parsed.seoTitle, "SEO başlığı");
    assert.equal(parsed.seoDescription, "SEO açıklaması");
    assert.equal(parsed.canonicalUrl, "https://www.example.com/hello");
    assert.equal(parsed.robots, "noindex");
    assert.equal(parsed.expectedUpdatedAt, "2026-08-16T12:00:00.000Z");
  });

  it("requires expectedUpdatedAt for submit-review", () => {
    assert.throws(() => parseSubmitReviewBody({ versionId: VER }));
    const parsed = parseSubmitReviewBody({
      versionId: VER,
      expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
    });
    assert.equal(parsed.expectedUpdatedAt, "2026-08-16T12:00:00.000Z");
  });

  it("requires a meaningful note for request-changes and ignores client actor ids", () => {
    assert.throws(() =>
      parseRequestChangesBody({
        versionId: VER,
        expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
        note: "  ",
        staffUserId: "attacker",
      }),
    );
    const parsed = parseRequestChangesBody({
      versionId: VER,
      expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
      note: "  Please restore the dek  ",
      staffUserId: "attacker",
    });
    assert.equal(parsed.note, "Please restore the dek");
    assert.equal("staffUserId" in parsed, false);
  });

  it("ignores client-supplied scheduleGeneration on schedule", () => {
    const parsed = parseScheduleBody({
      versionId: VER,
      scheduledAt: "2026-08-18T12:30:00.000Z",
      scheduleGeneration: 99,
      workflowStatus: "APPROVED",
      role: "SUPER_ADMIN",
    });
    assert.equal(parsed.versionId, VER);
    assert.equal(parsed.scheduledAt.toISOString(), "2026-08-18T12:30:00.000Z");
    assert.equal("scheduleGeneration" in parsed, false);
    assert.equal("workflowStatus" in parsed, false);
    assert.equal("role" in parsed, false);
  });

  it("accepts optional revision sourceVersionId and ignores client lifecycle fields", () => {
    const parsed = parseRevisionBody({
      sourceVersionId: VER,
      workflowStatus: "APPROVED",
      scheduleGeneration: 9,
      staffUserId: "attacker",
    });
    assert.equal(parsed.sourceVersionId, VER);
    assert.equal("workflowStatus" in parsed, false);
    assert.equal("scheduleGeneration" in parsed, false);
    assert.equal("staffUserId" in parsed, false);
    const implicit = parseRevisionBody({});
    assert.equal("sourceVersionId" in implicit, true);
    assert.equal(implicit.sourceVersionId, undefined);
  });
});

describe("draft hero payload", () => {
  const MEDIA = "55555555-5555-4555-8555-555555555555";

  it("parses assign and remove payloads", () => {
    const assigned = parseDraftHeroBody({
      versionId: VER,
      expectedUpdatedAt: "2026-08-19T10:00:00.000Z",
      mediaId: MEDIA,
      altText: "  crowd  ",
      credit: " Ada ",
    });
    assert.equal(assigned.mediaId, MEDIA);
    assert.equal(assigned.altText, "crowd");
    assert.equal(assigned.credit, "Ada");

    const removed = parseDraftHeroBody({
      versionId: VER,
      expectedUpdatedAt: "2026-08-19T10:00:00.000Z",
      mediaId: null,
    });
    assert.equal(removed.mediaId, null);
  });

  it("rejects invalid media id, malformed timestamp, wrong type, and oversized text", () => {
    assert.throws(
      () =>
        parseDraftHeroBody({
          versionId: VER,
          expectedUpdatedAt: "2026-08-19T10:00:00.000Z",
          mediaId: "not-a-uuid",
        }),
    );
    assert.throws(
      () =>
        parseDraftHeroBody({
          versionId: VER,
          expectedUpdatedAt: "yesterday",
          mediaId: MEDIA,
        }),
    );
    assert.throws(
      () =>
        parseDraftHeroBody({
          versionId: VER,
          expectedUpdatedAt: "2026-08-19T10:00:00.000Z",
          mediaId: MEDIA,
          altText: "x".repeat(501),
        }),
    );
    assert.throws(
      () =>
        parseDraftHeroBody({
          versionId: VER,
          expectedUpdatedAt: "2026-08-19T10:00:00.000Z",
          mediaId: MEDIA,
          credit: "x".repeat(201),
        }),
    );
  });
});

describe("draft gallery payload", () => {
  const MEDIA = "55555555-5555-4555-8555-555555555555";
  const MEDIA_B = "66666666-6666-4666-8666-666666666666";

  it("parses ordered items and empty replacement", () => {
    const parsed = parseDraftGalleryBody({
      versionId: VER,
      expectedUpdatedAt: "2026-08-19T10:00:00.000Z",
      items: [
        { mediaId: MEDIA_B, caption: " Two ", altText: "b" },
        { mediaId: MEDIA, credit: " Ada " },
      ],
    });
    assert.equal(parsed.items.length, 2);
    assert.equal(parsed.items[0]?.mediaId, MEDIA_B);
    assert.equal(parsed.items[0]?.caption, " Two ");
    const empty = parseDraftGalleryBody({
      versionId: VER,
      expectedUpdatedAt: "2026-08-19T10:00:00.000Z",
      items: [],
    });
    assert.deepEqual(empty.items, []);
  });

  it("rejects duplicate media, invalid ids, and oversized caption", () => {
    assert.throws(() =>
      parseDraftGalleryBody({
        versionId: VER,
        expectedUpdatedAt: "2026-08-19T10:00:00.000Z",
        items: [{ mediaId: MEDIA }, { mediaId: MEDIA }],
      }),
    );
    assert.throws(() =>
      parseDraftGalleryBody({
        versionId: VER,
        expectedUpdatedAt: "2026-08-19T10:00:00.000Z",
        items: [{ mediaId: "not-a-uuid" }],
      }),
    );
    assert.throws(() =>
      parseDraftGalleryBody({
        versionId: VER,
        expectedUpdatedAt: "2026-08-19T10:00:00.000Z",
        items: [{ mediaId: MEDIA, caption: "x".repeat(501) }],
      }),
    );
  });
});

describe("content slug payload", () => {
  it("requires a canonical slug and expectedUpdatedAt", () => {
    const parsed = parseContentSlugBody({
      slug: "Yeni-Haber",
      expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
    });
    assert.equal(parsed.slug, "yeni-haber");
    assert.equal(parsed.expectedUpdatedAt, "2026-08-16T12:00:00.000Z");
  });

  it("rejects an invalid slug with the shared INVALID_SLUG code", () => {
    try {
      parseContentSlugBody({
        slug: "Hello World",
        expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
      });
      assert.fail("expected throw");
    } catch (error) {
      assert.equal(
        error instanceof Error && "code" in error
          ? (error as { code: string }).code
          : null,
        PUBLISHING_ERROR.INVALID_SLUG,
      );
    }
  });
});
