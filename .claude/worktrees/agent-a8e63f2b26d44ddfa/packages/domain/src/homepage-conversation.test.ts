import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLICATION_STATUS } from "./publication-status";
import { STAFF_ROLE } from "./staff-role";
import {
  CONVERSATION_ERROR,
  CONVERSATION_LABEL_MAX_LENGTH,
  PUBLIC_HOMEPAGE_CONVERSATION_LIMIT,
  assertConversationExpectedUpdatedAt,
  assertConversationReorderPermutation,
  assignPublicConversationRanks,
  authorizeHomepageConversationWrite,
  canonicalizeConversationLabel,
  canonicalizeConversationReason,
  canonicalizeOptionalContentItemId,
  publicConversationArticlePointer,
} from "./homepage-conversation";

describe("homepage conversation authorization", () => {
  it("allows SUPER_ADMIN via HOMEPAGE_MANAGE", () => {
    const result = authorizeHomepageConversationWrite({
      roles: [STAFF_ROLE.SUPER_ADMIN],
    });
    assert.deepEqual(result, { ok: true, value: true });
  });

  it("rejects EDITOR and AUTHOR", () => {
    assert.deepEqual(
      authorizeHomepageConversationWrite({ roles: [STAFF_ROLE.EDITOR] }),
      { ok: false, code: CONVERSATION_ERROR.FORBIDDEN },
    );
    assert.deepEqual(
      authorizeHomepageConversationWrite({ roles: [STAFF_ROLE.AUTHOR] }),
      { ok: false, code: CONVERSATION_ERROR.FORBIDDEN },
    );
  });
});

describe("homepage conversation field canonicalization", () => {
  it("trims a valid label", () => {
    assert.deepEqual(canonicalizeConversationLabel("  Hande Erçel  "), {
      ok: true,
      value: "Hande Erçel",
    });
  });

  it("rejects empty or oversized labels", () => {
    assert.deepEqual(canonicalizeConversationLabel("   "), {
      ok: false,
      code: CONVERSATION_ERROR.INVALID_LABEL,
    });
    assert.deepEqual(
      canonicalizeConversationLabel("x".repeat(CONVERSATION_LABEL_MAX_LENGTH + 1)),
      { ok: false, code: CONVERSATION_ERROR.INVALID_LABEL },
    );
  });

  it("treats blank reason as null", () => {
    assert.deepEqual(canonicalizeConversationReason("  "), {
      ok: true,
      value: null,
    });
    assert.deepEqual(canonicalizeConversationReason(null), {
      ok: true,
      value: null,
    });
  });

  it("rejects a malformed content item id", () => {
    assert.deepEqual(canonicalizeOptionalContentItemId("not-a-uuid"), {
      ok: false,
      code: CONVERSATION_ERROR.INVALID_CONTENT_ITEM,
    });
  });
});

describe("homepage conversation ranking", () => {
  it("assigns deterministic 1-based ranks and caps at 5", () => {
    const ranked = assignPublicConversationRanks(
      ["a", "b", "c", "d", "e", "f"].map((id) => ({ id })),
    );
    assert.equal(PUBLIC_HOMEPAGE_CONVERSATION_LIMIT, 5);
    assert.deepEqual(
      ranked.map((item) => ({ rank: item.rank, id: item.id })),
      [
        { rank: 1, id: "a" },
        { rank: 2, id: "b" },
        { rank: 3, id: "c" },
        { rank: 4, id: "d" },
        { rank: 5, id: "e" },
      ],
    );
  });
});

describe("homepage conversation reorder permutation", () => {
  it("accepts a complete unique permutation", () => {
    const result = assertConversationReorderPermutation({
      currentIds: ["a", "b", "c"],
      orderedIds: ["c", "a", "b"],
    });
    assert.deepEqual(result, { ok: true, value: ["c", "a", "b"] });
  });

  it("rejects missing, extra, or duplicate ids", () => {
    assert.equal(
      assertConversationReorderPermutation({
        currentIds: ["a", "b"],
        orderedIds: ["a"],
      }).ok,
      false,
    );
    assert.equal(
      assertConversationReorderPermutation({
        currentIds: ["a", "b"],
        orderedIds: ["a", "b", "c"],
      }).ok,
      false,
    );
    assert.equal(
      assertConversationReorderPermutation({
        currentIds: ["a", "b"],
        orderedIds: ["a", "a"],
      }).ok,
      false,
    );
  });
});

describe("homepage conversation write conflict", () => {
  it("rejects a stale updatedAt token", () => {
    const t1 = new Date("2026-08-18T09:00:00.000Z");
    const t2 = new Date("2026-08-18T09:00:01.000Z");
    assert.deepEqual(
      assertConversationExpectedUpdatedAt({
        currentUpdatedAt: t2,
        expectedUpdatedAt: t1,
      }),
      { ok: false, code: CONVERSATION_ERROR.WRITE_CONFLICT },
    );
  });
});

describe("homepage conversation public article pointer", () => {
  const publishedId = "11111111-1111-4111-8111-111111111111";
  const versionId = "22222222-2222-4222-8222-222222222222";

  it("returns the published pointer for a live article", () => {
    assert.deepEqual(
      publicConversationArticlePointer({
        contentItemId: publishedId,
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: versionId,
        deletedAt: null,
      }),
      { contentItemId: publishedId, publishedVersionId: versionId },
    );
  });

  it("fails closed for unpublished, never-published, deleted, and incoherent rows", () => {
    assert.equal(
      publicConversationArticlePointer({
        contentItemId: publishedId,
        publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
        publishedVersionId: versionId,
        deletedAt: null,
      }),
      null,
    );
    assert.equal(
      publicConversationArticlePointer({
        contentItemId: publishedId,
        publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
        publishedVersionId: null,
        deletedAt: null,
      }),
      null,
    );
    assert.equal(
      publicConversationArticlePointer({
        contentItemId: publishedId,
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: versionId,
        deletedAt: new Date("2026-08-18T09:00:00.000Z"),
      }),
      null,
    );
    assert.equal(
      publicConversationArticlePointer({
        contentItemId: publishedId,
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: null,
        deletedAt: null,
      }),
      null,
    );
    assert.equal(
      publicConversationArticlePointer({
        contentItemId: null,
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: versionId,
        deletedAt: null,
      }),
      null,
    );
  });
});
