import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ENTITY_ERROR,
  ENTITY_STATUS,
  decideEntityActivate,
  decideEntityReactivate,
} from "@magazine/domain";

describe("decideEntityActivate", () => {
  it("allows DRAFT to ACTIVE when profile fields are valid", () => {
    const decision = decideEntityActivate({
      status: ENTITY_STATUS.DRAFT,
      deletedAt: null,
      mergedIntoEntityId: null,
      slug: "hande-ercel",
      canonicalName: "Hande Erçel",
      expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
      currentUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.value, ENTITY_STATUS.ACTIVE);
    }
  });

  it("rejects non-draft activation", () => {
    const decision = decideEntityActivate({
      status: ENTITY_STATUS.ACTIVE,
      deletedAt: null,
      mergedIntoEntityId: null,
      slug: "hande-ercel",
      canonicalName: "Hande Erçel",
      expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
      currentUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, ENTITY_ERROR.INVALID_STATUS);
    }
  });
});

describe("decideEntityReactivate", () => {
  it("only reactivates archived entities", () => {
    const archived = decideEntityReactivate({
      status: ENTITY_STATUS.ARCHIVED,
      deletedAt: null,
      mergedIntoEntityId: null,
    });
    assert.equal(archived.ok, true);

    const draft = decideEntityReactivate({
      status: ENTITY_STATUS.DRAFT,
      deletedAt: null,
      mergedIntoEntityId: null,
    });
    assert.equal(draft.ok, false);
    if (!draft.ok) {
      assert.equal(draft.code, ENTITY_ERROR.INVALID_STATUS);
    }
  });
});
