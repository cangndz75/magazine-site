import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONTENT_LEGAL_ERROR } from "@magazine/domain";
import { presentLegalFailure } from "./messages";

describe("legal mutation messages", () => {
  it("maps write conflicts to controlled recovery copy", () => {
    assert.match(
      presentLegalFailure(CONTENT_LEGAL_ERROR.CONTENT_WRITE_CONFLICT),
      /yenileyip tekrar deneyin/i,
    );
  });

  it("does not leak internal fields in user-facing errors", () => {
    const message = presentLegalFailure(CONTENT_LEGAL_ERROR.FORBIDDEN);
    assert.equal(message.includes("internalNote"), false);
  });
});
