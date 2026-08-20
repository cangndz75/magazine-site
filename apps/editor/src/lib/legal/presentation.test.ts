import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPublicNoticePreview,
  LEGAL_ACTION_FLOWS,
  presentLegalCurrentState,
} from "./presentation";

describe("legal presentation", () => {
  it("never includes internal note in public preview", () => {
    const preview = buildPublicNoticePreview({
      kind: "CORRECTION",
      publicNote: "Kamu metni",
    });
    assert.equal(preview.body, "Kamu metni");
    assert.equal(preview.label, "Düzeltme");
    const fallback = buildPublicNoticePreview({
      kind: "CLARIFICATION",
      publicNote: null,
    });
    assert.equal(fallback.label, "Açıklama");
  });

  it("describes high-impact flows with explicit consequence copy", () => {
    assert.match(LEGAL_ACTION_FLOWS.retraction.consequenceSummary, /geri çek/i);
    assert.match(LEGAL_ACTION_FLOWS.takedown.consequenceSummary, /kaldır/i);
    assert.match(LEGAL_ACTION_FLOWS["legal-hold-apply"].consequenceSummary, /engellenecek/i);
    assert.notEqual(
      LEGAL_ACTION_FLOWS.retraction.confirmTitle,
      "Emin misiniz?",
    );
  });

  it("maps current legal state labels", () => {
    assert.equal(
      presentLegalCurrentState({
        legalHoldAt: "2026-01-01T00:00:00.000Z",
        retractedAt: null,
        takedownAt: null,
        publicationStatus: "PUBLISHED",
      }),
      "Legal hold aktif",
    );
    assert.equal(
      presentLegalCurrentState({
        legalHoldAt: null,
        retractedAt: "2026-01-01T00:00:00.000Z",
        takedownAt: null,
        publicationStatus: "PUBLISHED",
      }),
      "Geri çekildi",
    );
  });
});
