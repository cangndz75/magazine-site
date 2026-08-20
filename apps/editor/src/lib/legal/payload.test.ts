import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTENT_LEGAL_ACTION_TYPE,
  CONTENT_LEGAL_REASON_CATEGORY,
} from "@magazine/domain";
import { parseRecordLegalActionBody } from "./payload";

describe("legal action payload", () => {
  it("parses a complete legal mutation body", () => {
    const parsed = parseRecordLegalActionBody({
      actionType: CONTENT_LEGAL_ACTION_TYPE.CORRECTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.FACTUAL_ERROR,
      internalNote: "Staff-only rationale.",
      publicNote: "Public correction text.",
      expectedUpdatedAt: "2026-03-01T10:00:00.000Z",
    });
    assert.equal(parsed.actionType, CONTENT_LEGAL_ACTION_TYPE.CORRECTION);
    assert.equal(parsed.internalNote, "Staff-only rationale.");
    assert.equal(parsed.publicNote, "Public correction text.");
  });

  it("requires polarity only through action type defaults on the server", () => {
    const parsed = parseRecordLegalActionBody({
      actionType: CONTENT_LEGAL_ACTION_TYPE.LEGAL_HOLD,
      polarity: "APPLY",
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.COURT_ORDER,
      internalNote: "Hold note.",
      expectedUpdatedAt: "2026-03-01T10:00:00.000Z",
    });
    assert.equal(parsed.polarity, "APPLY");
  });
});
