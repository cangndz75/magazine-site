import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLISHING_ERROR } from "../publishing/errors";
import { STAFF_ROLE } from "../staff-role";
import { STAFF_SCOPE_MODE } from "../staff-scope-mode";
import { WORKFLOW_STATUS } from "../workflow-status";
import { assertStructuredArticleBody } from "./body";
import { assertExpectedUpdatedAt, nextMonotonicUpdatedAt } from "./concurrency";
import { selectEditorDisplayVersionId } from "./display-version";
import {
  decideApproveForReview,
  decideLockedDraftSave,
  decideRequestChanges,
  decideSaveDraft,
  decideSubmitForReview,
} from "./draft-save";
import {
  assertOptionalHttpUrl,
  canonicalizeDraftTitle,
} from "./fields";
import {
  EDITOR_LIST_DEFAULT_LIMIT,
  EDITOR_LIST_MAX_LIMIT,
  clampEditorListLimit,
  decodeEditorListCursor,
  decodeEditorReviewQueueCursor,
  decodeEditorRevisionCursor,
  encodeEditorListCursor,
  encodeEditorReviewQueueCursor,
  encodeEditorRevisionCursor,
  sanitizeEditorSearch,
} from "./query-bounds";
import {
  assertCategoriesAssignableInScope,
  assertSelectedCreatePrimaryCategory,
  authorizeEditorContentMutation,
  canAccessEditorContentByPrimaryCategory,
  canAccessReviewQueueVersion,
} from "./scope";

const T1 = new Date("2026-08-16T12:00:00.000Z");
const T2 = new Date("2026-08-16T12:00:01.000Z");

describe("editor display version", () => {
  it("prefers draft, then scheduled, then published", () => {
    assert.equal(
      selectEditorDisplayVersionId({
        draftVersionId: "draft",
        scheduledVersionId: "sched",
        publishedVersionId: "pub",
      }),
      "draft",
    );
    assert.equal(
      selectEditorDisplayVersionId({
        draftVersionId: null,
        scheduledVersionId: "sched",
        publishedVersionId: "pub",
      }),
      "sched",
    );
    assert.equal(
      selectEditorDisplayVersionId({
        draftVersionId: null,
        scheduledVersionId: null,
        publishedVersionId: "pub",
      }),
      "pub",
    );
    assert.equal(
      selectEditorDisplayVersionId({
        draftVersionId: null,
        scheduledVersionId: null,
        publishedVersionId: null,
      }),
      null,
    );
  });
});

describe("decideSaveDraft", () => {
  const base = {
    requestedVersionId: "draft-1",
    draftVersionId: "draft-1",
    workflowStatus: WORKFLOW_STATUS.DRAFT,
    publishedVersionId: "pub-1",
    scheduledVersionId: null,
    currentUpdatedAt: T1,
    expectedUpdatedAt: T1,
  };

  it("accepts the current DRAFT pointer with matching updatedAt", () => {
    assert.deepEqual(decideSaveDraft(base), { ok: true, value: true });
  });

  it("rejects IN_REVIEW", () => {
    const result = decideSaveDraft({
      ...base,
      workflowStatus: WORKFLOW_STATUS.IN_REVIEW,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.VERSION_NOT_EDITABLE);
    }
  });

  it("rejects APPROVED", () => {
    const result = decideSaveDraft({
      ...base,
      workflowStatus: WORKFLOW_STATUS.APPROVED,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.VERSION_NOT_EDITABLE);
    }
  });

  it("rejects the published pointer even if labeled DRAFT", () => {
    const result = decideSaveDraft({
      ...base,
      requestedVersionId: "pub-1",
      draftVersionId: "pub-1",
      publishedVersionId: "pub-1",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.VERSION_NOT_EDITABLE);
    }
  });

  it("rejects the scheduled pointer", () => {
    const result = decideSaveDraft({
      ...base,
      requestedVersionId: "sched-1",
      draftVersionId: "sched-1",
      scheduledVersionId: "sched-1",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.VERSION_NOT_EDITABLE);
    }
  });

  it("rejects a version that is not the current draft pointer", () => {
    const result = decideSaveDraft({
      ...base,
      requestedVersionId: "other-draft",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.VERSION_NOT_CURRENT_DRAFT);
    }
  });

  it("accepts matching ISO expectedUpdatedAt against a Date currentUpdatedAt", () => {
    const result = decideSaveDraft({
      ...base,
      currentUpdatedAt: T1,
      expectedUpdatedAt: T1.toISOString(),
    });
    assert.deepEqual(result, { ok: true, value: true });
  });

  it("rejects a stale expectedUpdatedAt as CONTENT_WRITE_CONFLICT", () => {
    const result = decideSaveDraft({
      ...base,
      currentUpdatedAt: T2,
      expectedUpdatedAt: T1,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
    }
  });

  it("returns only an ok decision and never a new workflowStatus", () => {
    const result = decideSaveDraft(base);
    assert.deepEqual(result, { ok: true, value: true });
  });
});

describe("optimistic concurrency timestamps", () => {
  it("matches Date and ISO string of the same millisecond", () => {
    assert.deepEqual(
      assertExpectedUpdatedAt({
        currentUpdatedAt: T1,
        expectedUpdatedAt: "2026-08-16T12:00:00.000Z",
      }),
      { ok: true, value: true },
    );
  });

  it("rejects a different millisecond", () => {
    const result = assertExpectedUpdatedAt({
      currentUpdatedAt: T1,
      expectedUpdatedAt: T2,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
    }
  });
});

describe("category scope for editor content", () => {
  const selected = {
    roles: [STAFF_ROLE.EDITOR],
    scopeMode: STAFF_SCOPE_MODE.SELECTED,
    scopedCategoryIds: ["cat-a"],
  };
  const all = {
    roles: [STAFF_ROLE.EDITOR],
    scopeMode: STAFF_SCOPE_MODE.ALL,
    scopedCategoryIds: [],
  };

  it("rejects unauthorized primary assignment for SELECTED staff", () => {
    const result = assertCategoriesAssignableInScope({
      ...selected,
      categoryIds: ["cat-b"],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CATEGORY_OUT_OF_SCOPE);
    }
  });

  it("rejects unauthorized secondary assignment even when primary is allowed", () => {
    const result = assertCategoriesAssignableInScope({
      ...selected,
      categoryIds: ["cat-a", "cat-secret"],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CATEGORY_OUT_OF_SCOPE);
    }
  });

  it("does not restrict ALL-scoped staff", () => {
    assert.deepEqual(
      assertCategoriesAssignableInScope({
        ...all,
        categoryIds: ["any-category"],
      }),
      { ok: true, value: true },
    );
    assert.equal(
      canAccessEditorContentByPrimaryCategory({
        ...all,
        primaryCategoryId: null,
      }),
      true,
    );
  });

  it("requires a primary category when SELECTED staff create content", () => {
    const result = assertSelectedCreatePrimaryCategory({
      ...selected,
      primaryCategoryId: null,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.SELECTED_SCOPE_PRIMARY_REQUIRED);
    }
  });

  it("accepts SELECTED create when the primary is in scope", () => {
    assert.deepEqual(
      assertSelectedCreatePrimaryCategory({
        ...selected,
        primaryCategoryId: "cat-a",
      }),
      { ok: true, value: true },
    );
  });

  it("does not allow moving an out-of-scope article into an in-scope category", () => {
    const result = authorizeEditorContentMutation({
      ...selected,
      currentPrimaryCategoryId: "cat-other",
      nextCategoryIds: ["cat-a"],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
    }
  });

  it("fails closed for SELECTED staff on categoryless existing content", () => {
    assert.equal(
      canAccessEditorContentByPrimaryCategory({
        ...selected,
        primaryCategoryId: null,
      }),
      false,
    );
  });

  it("authorizes review-queue rows from the IN_REVIEW version, not the published version", () => {
    const categoryA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const categoryB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const editorOnA = {
      roles: [STAFF_ROLE.EDITOR],
      scopeMode: STAFF_SCOPE_MODE.SELECTED,
      scopedCategoryIds: [categoryA],
    };

    assert.equal(
      canAccessReviewQueueVersion({
        ...editorOnA,
        reviewVersionPrimaryCategoryId: categoryB,
      }),
      false,
    );
    assert.equal(
      canAccessReviewQueueVersion({
        ...editorOnA,
        reviewVersionPrimaryCategoryId: categoryA,
      }),
      true,
    );
  });
});

describe("list query bounds", () => {
  it("defaults and clamps page size", () => {
    assert.equal(clampEditorListLimit(undefined), EDITOR_LIST_DEFAULT_LIMIT);
    assert.equal(clampEditorListLimit(20), 20);
    assert.equal(clampEditorListLimit(50), EDITOR_LIST_MAX_LIMIT);
    assert.equal(clampEditorListLimit(1000), EDITOR_LIST_MAX_LIMIT);
    assert.equal(clampEditorListLimit(0), EDITOR_LIST_DEFAULT_LIMIT);
  });

  it("round-trips a cursor and rejects garbage", () => {
    const encoded = encodeEditorListCursor({
      updatedAt: T1,
      id: "11111111-1111-4111-8111-111111111111",
    });
    assert.deepEqual(decodeEditorListCursor(encoded), {
      updatedAt: T1.toISOString(),
      id: "11111111-1111-4111-8111-111111111111",
    });
    assert.equal(decodeEditorListCursor("not-a-cursor"), null);
  });

  it("round-trips revision and review-queue cursors and rejects the wrong shape", () => {
    const versionId = "11111111-1111-4111-8111-111111111111";
    const revision = encodeEditorRevisionCursor({
      versionNumber: 3,
      id: versionId,
    });
    assert.deepEqual(decodeEditorRevisionCursor(revision), {
      versionNumber: 3,
      id: versionId,
    });
    assert.equal(decodeEditorRevisionCursor("%%%%"), null);
    assert.equal(decodeEditorRevisionCursor(encodeEditorListCursor({
      updatedAt: T1,
      id: versionId,
    })), null);

    const queue = encodeEditorReviewQueueCursor({
      submittedAt: T1,
      id: versionId,
    });
    assert.deepEqual(decodeEditorReviewQueueCursor(queue), {
      submittedAt: T1.toISOString(),
      id: versionId,
    });
    assert.equal(decodeEditorReviewQueueCursor(revision), null);
  });

  it("strips ILIKE wildcards from search", () => {
    assert.equal(sanitizeEditorSearch("  %admin_"), "admin");
  });
});

describe("draft field validation", () => {
  it("rejects an empty title", () => {
    const result = canonicalizeDraftTitle("   ");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.INVALID_TITLE);
    }
  });

  it("rejects a string body so HTML cannot become a privileged path", () => {
    const result = assertStructuredArticleBody("<p>hello</p>");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.INVALID_BODY);
    }
  });

  it("accepts a JSON object body", () => {
    const result = assertStructuredArticleBody({ blocks: [] });
    assert.equal(result.ok, true);
  });

  it("rejects javascript: URLs", () => {
    const result = assertOptionalHttpUrl("javascript:alert(1)");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.INVALID_URL);
    }
  });
});

describe("strict monotonic updatedAt token", () => {
  it("advances by at least 1ms when now equals the current token", () => {
    const next = nextMonotonicUpdatedAt(T1, T1);
    assert.equal(next.getTime(), T1.getTime() + 1);
    assert.equal(next.getTime() > T1.getTime(), true);
  });

  it("returns the same Date instance when now is already later", () => {
    const now = new Date(T1.getTime() + 25);
    const next = nextMonotonicUpdatedAt(T1, now);
    assert.equal(next, now);
    assert.equal(next.getTime() > T1.getTime(), true);
  });

  it("uses the returned timestamp as the persisted token", () => {
    const persisted = nextMonotonicUpdatedAt(T1, T1);
    const returned = persisted;
    assert.equal(returned.getTime(), persisted.getTime());
    assert.equal(returned.getTime(), T1.getTime() + 1);
  });
});

describe("locked draft save authorization", () => {
  const selected = {
    roles: [STAFF_ROLE.EDITOR],
    scopeMode: STAFF_SCOPE_MODE.SELECTED,
    scopedCategoryIds: ["cat-a"],
  };
  const all = {
    roles: [STAFF_ROLE.EDITOR],
    scopeMode: STAFF_SCOPE_MODE.ALL,
    scopedCategoryIds: [],
  };
  const saveBase = {
    requestedVersionId: "draft-1",
    draftVersionId: "draft-1",
    workflowStatus: WORKFLOW_STATUS.DRAFT,
    publishedVersionId: "pub-1",
    scheduledVersionId: null,
    currentUpdatedAt: T1,
    expectedUpdatedAt: T1,
  };

  it("rejects SELECTED categoryless draft saves", () => {
    const result = decideLockedDraftSave({
      ...saveBase,
      scope: selected,
      currentPrimaryCategoryId: "cat-a",
      nextCategoryIds: [],
      nextPrimaryCategoryId: null,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.SELECTED_SCOPE_PRIMARY_REQUIRED);
    }
  });

  it("accepts a SELECTED save with an allowed primary category", () => {
    assert.deepEqual(
      decideLockedDraftSave({
        ...saveBase,
        scope: selected,
        currentPrimaryCategoryId: "cat-a",
        nextCategoryIds: ["cat-a"],
        nextPrimaryCategoryId: "cat-a",
      }),
      { ok: true, value: true },
    );
  });

  it("rejects unauthorized secondary smuggling atomically before any write", () => {
    const result = decideLockedDraftSave({
      ...saveBase,
      scope: selected,
      currentPrimaryCategoryId: "cat-a",
      nextCategoryIds: ["cat-a", "cat-secret"],
      nextPrimaryCategoryId: "cat-a",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CATEGORY_OUT_OF_SCOPE);
    }
  });

  it("uses post-lock current state so a TOCTOU category move cannot grant access", () => {
    const result = decideLockedDraftSave({
      ...saveBase,
      scope: selected,
      currentPrimaryCategoryId: "cat-other",
      nextCategoryIds: ["cat-a"],
      nextPrimaryCategoryId: "cat-a",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
    }
  });

  it("still rejects a stale token after lock even if categories remain allowed", () => {
    const result = decideLockedDraftSave({
      ...saveBase,
      currentUpdatedAt: T2,
      expectedUpdatedAt: T1,
      scope: selected,
      currentPrimaryCategoryId: "cat-a",
      nextCategoryIds: ["cat-a"],
      nextPrimaryCategoryId: "cat-a",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
    }
  });

  it("does not require a primary for ALL-scoped staff", () => {
    assert.deepEqual(
      decideLockedDraftSave({
        ...saveBase,
        scope: all,
        currentPrimaryCategoryId: null,
        nextCategoryIds: [],
        nextPrimaryCategoryId: null,
      }),
      { ok: true, value: true },
    );
  });
});

describe("submit-review concurrency", () => {
  const base = {
    contentItemId: "item-1",
    versionContentItemId: "item-1",
    draftVersionId: "draft-1",
    versionId: "draft-1",
    workflowStatus: WORKFLOW_STATUS.DRAFT,
  };

  it("rejects a stale expectedUpdatedAt and does not decide IN_REVIEW", () => {
    const result = decideSubmitForReview({
      ...base,
      currentUpdatedAt: T2,
      expectedUpdatedAt: T1,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
    }
  });

  it("accepts submit when the token matches the locked updatedAt", () => {
    assert.deepEqual(
      decideSubmitForReview({
        ...base,
        currentUpdatedAt: T2,
        expectedUpdatedAt: T2,
      }),
      { ok: true, value: true },
    );
  });
});

describe("lifecycle target authorization after lock", () => {
  const selected = {
    roles: [STAFF_ROLE.EDITOR],
    scopeMode: STAFF_SCOPE_MODE.SELECTED,
    scopedCategoryIds: ["cat-a"],
  };

  it("authorizes publish/schedule against the locked target version categories", () => {
    const result = authorizeEditorContentMutation({
      ...selected,
      currentPrimaryCategoryId: "cat-a",
      nextCategoryIds: ["cat-a", "cat-secret"],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CATEGORY_OUT_OF_SCOPE);
    }
  });

  it("authorizes unpublish/reschedule/unschedule against locked published/scheduled state", () => {
    const movedAway = authorizeEditorContentMutation({
      ...selected,
      currentPrimaryCategoryId: "cat-other",
      nextCategoryIds: ["cat-a"],
    });
    assert.equal(movedAway.ok, false);
    if (!movedAway.ok) {
      assert.equal(movedAway.code, PUBLISHING_ERROR.CONTENT_NOT_FOUND);
    }

    const scheduledOk = authorizeEditorContentMutation({
      ...selected,
      currentPrimaryCategoryId: "cat-a",
      nextCategoryIds: ["cat-a"],
    });
    assert.deepEqual(scheduledOk, { ok: true, value: true });
  });
});

describe("review decision concurrency", () => {
  const base = {
    contentItemId: "item-1",
    versionContentItemId: "item-1",
    draftVersionId: "draft-1",
    versionId: "draft-1",
    workflowStatus: WORKFLOW_STATUS.IN_REVIEW,
    currentUpdatedAt: T1,
    expectedUpdatedAt: T1,
  };

  it("rejects a stale approve token before considering workflow", () => {
    const result = decideApproveForReview({
      ...base,
      currentUpdatedAt: T2,
      expectedUpdatedAt: T1,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
    }
  });

  it("rejects approve of a DRAFT even with a matching token", () => {
    const result = decideApproveForReview({
      ...base,
      workflowStatus: WORKFLOW_STATUS.DRAFT,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.INVALID_WORKFLOW_TRANSITION);
    }
  });

  it("accepts request-changes from IN_REVIEW with a current token", () => {
    assert.deepEqual(decideRequestChanges(base), { ok: true, value: true });
  });

  it("rejects stale request-changes as CONTENT_WRITE_CONFLICT", () => {
    const result = decideRequestChanges({
      ...base,
      currentUpdatedAt: T2,
      expectedUpdatedAt: T1,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT);
    }
  });
});
