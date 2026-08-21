import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CAPABILITY } from "./capability";
import { hasCapability } from "./authorization";
import { PUBLICATION_STATUS } from "./publication-status";
import { STAFF_ROLE } from "./staff-role";
import {
  CONTENT_LEGAL_ACTION_POLARITY,
  CONTENT_LEGAL_ACTION_TYPE,
  CONTENT_LEGAL_ERROR,
  CONTENT_LEGAL_REASON_CATEGORY,
  authorizeContentLegalMutation,
  canonicalizeContentLegalActionWrite,
  contentLegalAuditEventType,
  decideContentLegalAction,
  hasPublicationHistory,
  hasPublicLegalWithdrawal,
  isContentLegalHoldActive,
  type ContentLegalItemState,
} from "./legal-action";

const NOW = new Date("2026-08-20T12:00:00.000Z");
const TOKEN = new Date("2026-08-20T11:59:00.000Z");

function publishedItem(
  overrides: Partial<ContentLegalItemState> = {},
): ContentLegalItemState {
  return {
    deletedAt: null,
    publicationStatus: PUBLICATION_STATUS.PUBLISHED,
    publishedVersionId: "version-1",
    publishedAt: "2026-08-19T00:00:00.000Z",
    legalHoldAt: null,
    legalHoldReason: null,
    retractedAt: null,
    takedownAt: null,
    updatedAt: TOKEN,
    ...overrides,
  };
}

function write(
  overrides: Partial<{
    actionType: string;
    polarity: string;
    reasonCategory: string;
    internalNote: string;
    publicNote: string | null;
    effectiveAt: Date | string | null;
    expectedUpdatedAt: Date | string;
  }> = {},
) {
  return {
    actionType: CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
    reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.FACTUAL_ERROR,
    internalNote: "Factual date was wrong.",
    publicNote: "We corrected the date.",
    expectedUpdatedAt: TOKEN,
    ...overrides,
  };
}

describe("content legal capability", () => {
  it("gives CONTENT_LEGAL only to SUPER_ADMIN", () => {
    assert.equal(
      hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.CONTENT_LEGAL),
      true,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.CONTENT_LEGAL),
      false,
    );
    assert.equal(
      hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.CONTENT_LEGAL),
      false,
    );
    assert.deepEqual(authorizeContentLegalMutation({ roles: [STAFF_ROLE.EDITOR] }), {
      ok: false,
      code: CONTENT_LEGAL_ERROR.FORBIDDEN,
    });
    assert.deepEqual(
      authorizeContentLegalMutation({ roles: [STAFF_ROLE.SUPER_ADMIN] }),
      { ok: true, value: true },
    );
  });
});

describe("canonicalizeContentLegalActionWrite", () => {
  it("requires an internal note and accepts an optional public note", () => {
    const ok = canonicalizeContentLegalActionWrite({
      ...write(),
      now: NOW,
    });
    assert.equal(ok.ok, true);
    if (!ok.ok) {
      throw new Error("expected canonical write");
    }
    assert.equal(ok.value.polarity, CONTENT_LEGAL_ACTION_POLARITY.APPLY);
    assert.equal(ok.value.publicNote, "We corrected the date.");

    assert.equal(
      canonicalizeContentLegalActionWrite({
        ...write({ internalNote: "no" }),
        now: NOW,
      }).ok,
      false,
    );
    assert.equal(
      canonicalizeContentLegalActionWrite({
        ...write({ publicNote: "x".repeat(4001) }),
        now: NOW,
      }).ok,
      false,
    );
  });

  it("rejects RELEASE polarity on non-hold actions", () => {
    assert.deepEqual(
      canonicalizeContentLegalActionWrite({
        ...write({
          actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
          polarity: CONTENT_LEGAL_ACTION_POLARITY.RELEASE,
        }),
        now: NOW,
      }),
      { ok: false, code: CONTENT_LEGAL_ERROR.INVALID_LEGAL_ACTION },
    );
  });
});

describe("decideContentLegalAction", () => {
  it("records a correction without changing publication history fields", () => {
    const decision = decideContentLegalAction({
      item: publishedItem(),
      write: write(),
      now: NOW,
    });
    assert.equal(decision.ok, true);
    if (!decision.ok) {
      throw new Error("expected correction");
    }
    assert.equal(decision.value.actionType, CONTENT_LEGAL_ACTION_TYPE.CORRECTION);
    assert.equal(decision.value.nextRetractedAt, null);
    assert.equal(decision.value.nextTakedownAt, null);
    assert.equal(decision.value.nextLegalHoldAt, null);
    assert.equal(decision.value.invalidatesPublicCache, true);
    assert.equal(
      contentLegalAuditEventType(decision.value),
      "CONTENT_CORRECTION_RECORDED",
    );
  });

  it("records a clarification independently of workflow/publication status", () => {
    const decision = decideContentLegalAction({
      item: publishedItem({
        publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
      }),
      write: write({
        actionType: CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
        reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.CLARIFICATION,
        publicNote: null,
      }),
      now: NOW,
    });
    assert.equal(decision.ok, true);
    if (!decision.ok) {
      throw new Error("expected clarification");
    }
    assert.equal(
      decision.value.actionType,
      CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
    );
    assert.equal(decision.value.publicNote, null);
    assert.equal(decision.value.invalidatesPublicCache, true);
  });

  it("models retraction as an editorial withdrawal, not a delete", () => {
    const decision = decideContentLegalAction({
      item: publishedItem(),
      write: write({
        actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
        reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.EDITORIAL_STANDARDS,
      }),
      now: NOW,
    });
    assert.equal(decision.ok, true);
    if (!decision.ok) {
      throw new Error("expected retraction");
    }
    assert.equal(decision.value.nextRetractedAt?.getTime(), NOW.getTime());
    assert.equal(decision.value.invalidatesPublicCache, true);
    assert.equal(hasPublicLegalWithdrawal({ retractedAt: NOW }), true);
  });

  it("models takedown separately from ordinary unpublish", () => {
    const unpublished = publishedItem({
      publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
    });
    const decision = decideContentLegalAction({
      item: unpublished,
      write: write({
        actionType: CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN,
        reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
      }),
      now: NOW,
    });
    assert.equal(decision.ok, true);
    if (!decision.ok) {
      throw new Error("expected takedown");
    }
    assert.equal(decision.value.nextTakedownAt?.getTime(), NOW.getTime());
    assert.equal(unpublished.publicationStatus, PUBLICATION_STATUS.UNPUBLISHED);
  });

  it("places and releases legal hold without mutating publication status", () => {
    const placed = decideContentLegalAction({
      item: publishedItem(),
      write: write({
        actionType: CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD,
        polarity: CONTENT_LEGAL_ACTION_POLARITY.APPLY,
        reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
      }),
      now: NOW,
    });
    assert.equal(placed.ok, true);
    if (!placed.ok) {
      throw new Error("expected hold");
    }
    assert.equal(placed.value.nextLegalHoldAt?.getTime(), NOW.getTime());
    assert.equal(
      placed.value.nextLegalHoldReason,
      CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
    );
    assert.equal(isContentLegalHoldActive(placed.value.nextLegalHoldAt), true);

    const released = decideContentLegalAction({
      item: publishedItem({
        legalHoldAt: NOW,
        legalHoldReason: CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
      }),
      write: write({
        actionType: CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD,
        polarity: CONTENT_LEGAL_ACTION_POLARITY.RELEASE,
        reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
      }),
      now: NOW,
    });
    assert.equal(released.ok, true);
    if (!released.ok) {
      throw new Error("expected release");
    }
    assert.equal(released.value.nextLegalHoldAt, null);
    assert.equal(
      contentLegalAuditEventType(released.value),
      "CONTENT_LEGAL_HOLD_RELEASED",
    );
  });

  it("rejects unauthorized shapes, stale writes, and duplicate withdrawals", () => {
    assert.deepEqual(
      decideContentLegalAction({
        item: publishedItem({ updatedAt: TOKEN }),
        write: write({ expectedUpdatedAt: NOW }),
        now: NOW,
      }),
      { ok: false, code: CONTENT_LEGAL_ERROR.CONTENT_WRITE_CONFLICT },
    );
    assert.deepEqual(
      decideContentLegalAction({
        item: publishedItem({
          publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
          publishedVersionId: null,
          publishedAt: null,
        }),
        write: write(),
        now: NOW,
      }),
      { ok: false, code: CONTENT_LEGAL_ERROR.NOT_PUBLISHED },
    );
    assert.equal(
      hasPublicationHistory({
        publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
        publishedVersionId: null,
        publishedAt: null,
      }),
      false,
    );
    assert.deepEqual(
      decideContentLegalAction({
        item: publishedItem({ retractedAt: NOW }),
        write: write({ actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION }),
        now: NOW,
      }),
      { ok: false, code: CONTENT_LEGAL_ERROR.ALREADY_RETRACTED },
    );
    assert.deepEqual(
      decideContentLegalAction({
        item: publishedItem({ takedownAt: NOW }),
        write: write({ actionType: CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN }),
        now: NOW,
      }),
      { ok: false, code: CONTENT_LEGAL_ERROR.ALREADY_TAKEN_DOWN },
    );
    assert.deepEqual(
      decideContentLegalAction({
        item: publishedItem({ legalHoldAt: NOW }),
        write: write({
          actionType: CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD,
          polarity: CONTENT_LEGAL_ACTION_POLARITY.APPLY,
        }),
        now: NOW,
      }),
      { ok: false, code: CONTENT_LEGAL_ERROR.LEGAL_HOLD_ALREADY_ACTIVE },
    );
  });

  it("allows a correction while a legal hold is active", () => {
    const decision = decideContentLegalAction({
      item: publishedItem({
        legalHoldAt: NOW,
        legalHoldReason: CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
      }),
      write: write(),
      now: NOW,
    });
    assert.equal(decision.ok, true);
    if (!decision.ok) {
      throw new Error("expected correction during hold");
    }
    assert.equal(decision.value.nextLegalHoldAt?.getTime(), NOW.getTime());
    assert.equal(
      decision.value.nextLegalHoldReason,
      CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
    );
  });
});
