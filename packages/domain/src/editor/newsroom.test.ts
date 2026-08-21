import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NEWSROOM_SORT,
  NEWSROOM_VIEW,
  newsroomViewMatchesAttention,
  parseNewsroomSort,
  parseNewsroomView,
  summarizeListAttention,
  summarizeNewsroomReadiness,
} from "./newsroom";
import { READINESS_OVERALL_STATE } from "./readiness";

function baseInput(
  overrides: Partial<Parameters<typeof summarizeListAttention>[0]> = {},
) {
  return {
    publicationStatus: "NEVER_PUBLISHED" as const,
    workflowStatus: "DRAFT" as const,
    hasPrimaryCategory: true,
    authorCount: 1,
    legalHoldAt: null,
    retractedAt: null,
    takedownAt: null,
    changesRequestedNote: null,
    heroAssigned: false,
    heroRightsEligible: null,
    ...overrides,
  };
}

describe("newsroom params", () => {
  it("parses view and sort safely", () => {
    assert.equal(parseNewsroomView("in_review"), NEWSROOM_VIEW.IN_REVIEW);
    assert.equal(parseNewsroomView("bogus"), NEWSROOM_VIEW.ALL);
    assert.equal(parseNewsroomSort("schedule_asc"), NEWSROOM_SORT.SCHEDULE_ASC);
    assert.equal(parseNewsroomSort("bogus"), NEWSROOM_SORT.UPDATED_DESC);
  });
});

describe("list attention", () => {
  it("flags changes requested and blocked publish states", () => {
    const attention = summarizeListAttention(
      baseInput({
        changesRequestedNote: "Başlığı netleştir.",
      }),
    );
    assert.equal(attention.label, "Değişiklik istendi");
    assert.equal(attention.severity, "warning");
  });

  it("does not mark a normal draft urgent without reasons", () => {
    const attention = summarizeListAttention(baseInput());
    assert.equal(attention.severity, "none");
    assert.equal(newsroomViewMatchesAttention(baseInput()), false);
  });

  it("summarizes readiness without fake scores", () => {
    const readiness = summarizeNewsroomReadiness(
      baseInput({
        workflowStatus: "APPROVED",
        hasPrimaryCategory: false,
      }),
    );
    assert.equal(readiness.overallState, READINESS_OVERALL_STATE.BLOCKED);
    assert.equal(readiness.blockingCount > 0, true);
    assert.equal(typeof readiness.topIssue, "string");
  });
});
