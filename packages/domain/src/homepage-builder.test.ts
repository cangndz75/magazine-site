import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HOMEPAGE_SLOT_KEY,
  HOMEPAGE_BUILDER_ERROR,
  resolvePublicHomepagePlacements,
  assertHomepageSlotAssignmentsUnique,
  emptyHomepageSlotMap,
  resolveHomepageFeaturedNeighborMove,
  applyHomepageFeaturedSlotSwap,
  slotsFromAssignmentMap,
} from "./homepage-builder";
import { PUBLIC_HOMEPAGE_FEATURED_LIMIT } from "./homepage-second-viewport";

describe("homepage featured neighbor move", () => {
  it("resolves an adjacent Featured swap", () => {
    assert.deepEqual(
      resolveHomepageFeaturedNeighborMove({
        slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
        direction: "right",
      }),
      {
        ok: true,
        value: {
          from: HOMEPAGE_SLOT_KEY.FEATURED_1,
          to: HOMEPAGE_SLOT_KEY.FEATURED_2,
        },
      },
    );
  });

  it("rejects a move that leaves Featured or has no neighbor", () => {
    assert.deepEqual(
      resolveHomepageFeaturedNeighborMove({
        slotKey: HOMEPAGE_SLOT_KEY.LEAD,
        direction: "right",
      }),
      { ok: false, code: HOMEPAGE_BUILDER_ERROR.INVALID_SLOT },
    );
    assert.deepEqual(
      resolveHomepageFeaturedNeighborMove({
        slotKey: HOMEPAGE_SLOT_KEY.FEATURED_1,
        direction: "left",
      }),
      { ok: false, code: HOMEPAGE_BUILDER_ERROR.INVALID_SLOT },
    );
    assert.deepEqual(
      resolveHomepageFeaturedNeighborMove({
        slotKey: HOMEPAGE_SLOT_KEY.FEATURED_5,
        direction: "right",
      }),
      { ok: false, code: HOMEPAGE_BUILDER_ERROR.INVALID_SLOT },
    );
    assert.deepEqual(
      resolveHomepageFeaturedNeighborMove({
        slotKey: HOMEPAGE_SLOT_KEY.FEATURED_2,
        direction: "up",
      }),
      { ok: false, code: HOMEPAGE_BUILDER_ERROR.INVALID_SLOT },
    );
  });

  it("swaps two Featured assignments without touching ATF slots", () => {
    const assignments = {
      ...emptyHomepageSlotMap(),
      [HOMEPAGE_SLOT_KEY.LEAD]: "lead",
      [HOMEPAGE_SLOT_KEY.SUPPORT_1]: "support",
      [HOMEPAGE_SLOT_KEY.FEATURED_1]: "a",
      [HOMEPAGE_SLOT_KEY.FEATURED_2]: "b",
    };
    const swapped = applyHomepageFeaturedSlotSwap(
      assignments,
      HOMEPAGE_SLOT_KEY.FEATURED_1,
      HOMEPAGE_SLOT_KEY.FEATURED_2,
    );
    assert.equal(swapped[HOMEPAGE_SLOT_KEY.FEATURED_1], "b");
    assert.equal(swapped[HOMEPAGE_SLOT_KEY.FEATURED_2], "a");
    assert.equal(swapped[HOMEPAGE_SLOT_KEY.LEAD], "lead");
    assert.equal(swapped[HOMEPAGE_SLOT_KEY.SUPPORT_1], "support");
    assert.deepEqual(
      assertHomepageSlotAssignmentsUnique(slotsFromAssignmentMap(swapped)),
      { ok: true, value: true },
    );
  });
});

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
