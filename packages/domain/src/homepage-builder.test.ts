import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOMEPAGE_SLOT_KEY,
  HOMEPAGE_BUILDER_ERROR,
  resolvePublicHomepagePlacements,
  assertHomepageSlotAssignmentsUnique,
  emptyHomepageSlotMap,
} from "./homepage-builder";
import { PUBLIC_HOMEPAGE_FEATURED_LIMIT } from "./homepage-second-viewport";

describe("homepage builder slot uniqueness", () => {
  it("rejects duplicate content items in one composition", () => {
    const result = assertHomepageSlotAssignmentsUnique([
      { slotKey: HOMEPAGE_SLOT_KEY.LEAD, contentItemId: "a" },
      { slotKey: HOMEPAGE_SLOT_KEY.SUPPORT_1, contentItemId: "a" },
    ]);
    assert.deepEqual(result, {
      ok: false,
      code: HOMEPAGE_BUILDER_ERROR.DUPLICATE_CONTENT_ITEM,
    });
  });
});

describe("resolvePublicHomepagePlacements", () => {
  const candidates = [
    { id: "1", title: "one" },
    { id: "2", title: "two" },
    { id: "3", title: "three" },
    { id: "4", title: "four" },
    { id: "5", title: "five" },
    { id: "6", title: "six" },
    { id: "7", title: "seven" },
    { id: "8", title: "eight" },
  ];

  it("prefers editorial lead and fills supports and featured without duplicates", () => {
    const editorial = {
      ...emptyHomepageSlotMap(),
      [HOMEPAGE_SLOT_KEY.LEAD]: "8",
      [HOMEPAGE_SLOT_KEY.SUPPORT_1]: "7",
      [HOMEPAGE_SLOT_KEY.FEATURED_1]: "6",
    };
    const resolved = resolvePublicHomepagePlacements(
      editorial,
      candidates,
      PUBLIC_HOMEPAGE_FEATURED_LIMIT,
    );
    assert.equal(resolved.lead?.id, "8");
    assert.deepEqual(resolved.supports.map((s) => s.id), ["7", "1"]);
    assert.equal(resolved.featured[0]?.id, "6");
    const allIds = [
      resolved.lead?.id,
      ...resolved.supports.map((s) => s.id),
      ...resolved.featured.map((s) => s.id),
    ].filter(Boolean);
    assert.equal(new Set(allIds).size, allIds.length);
  });

  it("falls back when editorial assignment is unavailable in candidate pool", () => {
    const editorial = {
      ...emptyHomepageSlotMap(),
      [HOMEPAGE_SLOT_KEY.LEAD]: "missing",
    };
    const resolved = resolvePublicHomepagePlacements(
      editorial,
      candidates,
      PUBLIC_HOMEPAGE_FEATURED_LIMIT,
    );
    assert.equal(resolved.lead?.id, "1");
  });
});
