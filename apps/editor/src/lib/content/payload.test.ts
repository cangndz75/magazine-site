import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EDITOR_LIST_MAX_LIMIT, PUBLISHING_ERROR, STAFF_ROLE, STAFF_SCOPE_MODE } from "@magazine/domain";
import { parseEditorListSearchParams, parseReviewQueueSearchParams, parseRevisionHistorySearchParams, parseDiffSearchParams } from "./list-params";
import { parseArticleEditorSaveBody, parseCreateContentBody, parseDraftSaveBody, parseRequestChangesBody, parseSubmitReviewBody } from "./payload";

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
    });
    assert.deepEqual(parsed.body, {
      blocks: [{ type: "paragraph", text: "Gövde" }],
    });
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
});
