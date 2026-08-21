import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONTENT_LEGAL_ACTION_TYPE } from "./legal-action";
import {
  legalActionInvalidatesPublicCache,
  PUBLIC_ARTICLE_WITHDRAWAL_KIND,
  PUBLIC_LEGAL_NOTICE_KIND,
  resolvePublicWithdrawalKind,
  toPublicLegalNotice,
} from "./public-legal";

const NOW = new Date("2026-03-10T12:00:00.000Z");

describe("public legal projection", () => {
  it("maps correction and clarification actions to distinct public notices", () => {
    const correction = toPublicLegalNotice({
      actionType: CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
      publicNote: "We corrected the date.",
      effectiveAt: NOW,
    });
    assert.deepEqual(correction, {
      kind: PUBLIC_LEGAL_NOTICE_KIND.CORRECTION,
      publicNote: "We corrected the date.",
      effectiveAt: NOW,
    });

    const clarification = toPublicLegalNotice({
      actionType: CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
      publicNote: null,
      effectiveAt: NOW,
    });
    assert.deepEqual(clarification, {
      kind: PUBLIC_LEGAL_NOTICE_KIND.CLARIFICATION,
      publicNote: null,
      effectiveAt: NOW,
    });

    assert.equal(
      toPublicLegalNotice({
        actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
        publicNote: "hidden",
        effectiveAt: NOW,
      }),
      null,
    );
  });

  it("prefers takedown semantics when both withdrawal markers are present", () => {
    assert.equal(
      resolvePublicWithdrawalKind({
        retractedAt: NOW,
        takedownAt: NOW,
      }),
      PUBLIC_ARTICLE_WITHDRAWAL_KIND.TAKEDOWN,
    );
    assert.equal(
      resolvePublicWithdrawalKind({
        retractedAt: NOW,
        takedownAt: null,
      }),
      PUBLIC_ARTICLE_WITHDRAWAL_KIND.RETRACTION,
    );
  });

  it("invalidates public cache for public-facing legal actions only", () => {
    assert.equal(
      legalActionInvalidatesPublicCache({
        actionType: CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
      }),
      true,
    );
    assert.equal(
      legalActionInvalidatesPublicCache({
        actionType: CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION,
      }),
      true,
    );
    assert.equal(
      legalActionInvalidatesPublicCache({
        actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
      }),
      true,
    );
    assert.equal(
      legalActionInvalidatesPublicCache({
        actionType: CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN,
      }),
      true,
    );
    assert.equal(
      legalActionInvalidatesPublicCache({
        actionType: CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD,
      }),
      false,
    );
  });
});
