import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOMEPAGE_SLOT_KEY, HOMEPAGE_SLOT_KEYS } from "../homepage-builder";
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_EVENT_REGISTRY,
  ANALYTICS_PLACEMENT,
  ANALYTICS_RETIRED_EVENT_NAMES,
  ANALYTICS_TAXONOMY_VERSION,
  analyticsHomepageSlotOrdinal,
  analyticsPlacementFromHomepageSlot,
  isAnalyticsEventName,
  isRetiredAnalyticsEventName,
} from "./index";

describe("analytics taxonomy registry", () => {
  it("pins schema version 1 in the contract, not only documentation", () => {
    assert.equal(ANALYTICS_TAXONOMY_VERSION, 1);
    for (const name of ANALYTICS_EVENT_NAMES) {
      assert.equal(ANALYTICS_EVENT_REGISTRY[name].schemaVersion, 1);
      assert.equal(ANALYTICS_EVENT_REGISTRY[name].retired, false);
      assert.equal(ANALYTICS_EVENT_REGISTRY[name].meaning.length > 0, true);
    }
  });

  it("accepts only registered event names and rejects unknown names", () => {
    assert.equal(isAnalyticsEventName("ARTICLE_VIEW"), true);
    assert.equal(isAnalyticsEventName("PAGE_VIEW"), true);
    assert.equal(isAnalyticsEventName("engaged_reader"), false);
    assert.equal(isAnalyticsEventName("ARTICLE_COMPLETED"), false);
    assert.equal(isRetiredAnalyticsEventName("ARTICLE_VIEW"), false);
    assert.deepEqual(ANALYTICS_RETIRED_EVENT_NAMES, []);
  });

  it("keeps a stable meaning for every v1 event name", () => {
    assert.equal(
      ANALYTICS_EVENT_REGISTRY[ANALYTICS_EVENT_NAME.ARTICLE_VIEW].meaning.includes(
        "withdrawn",
      ),
      true,
    );
    assert.equal(
      ANALYTICS_EVENT_REGISTRY[ANALYTICS_EVENT_NAME.PAGE_VIEW].meaning.includes(
        "not a live article view",
      ),
      true,
    );
    assert.equal(
      ANALYTICS_EVENT_REGISTRY[ANALYTICS_EVENT_NAME.VIDEO_PLAY].meaning.includes(
        "deferred",
      ),
      true,
    );
  });

  it("reuses Homepage Builder slot keys instead of CSS position names", () => {
    for (const slot of HOMEPAGE_SLOT_KEYS) {
      assert.equal(analyticsPlacementFromHomepageSlot(slot), slot);
    }
    assert.equal(ANALYTICS_PLACEMENT.LEAD, HOMEPAGE_SLOT_KEY.LEAD);
    assert.equal(ANALYTICS_PLACEMENT.CONVERSATION, "CONVERSATION");
    assert.equal(ANALYTICS_PLACEMENT.HOMEPAGE_VIDEO, "HOMEPAGE_VIDEO");
    assert.equal(analyticsHomepageSlotOrdinal(HOMEPAGE_SLOT_KEY.SUPPORT_2), 2);
    assert.equal(analyticsHomepageSlotOrdinal(HOMEPAGE_SLOT_KEY.FEATURED_4), 4);
  });
});
