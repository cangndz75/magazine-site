import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOMEPAGE_SLOT_KEY } from "../homepage-builder";
import {
  ANALYTICS_EVENT_NAME,
  ANALYTICS_GALLERY_NAVIGATION_METHOD,
  ANALYTICS_IMPRESSION_POLICY,
  ANALYTICS_PLACEMENT,
  VIDEO_PLAY_MEASUREMENT,
  buildPublishedHomepageContentPlacements,
  galleryAnalyticsEmissions,
  selectedAnalyticsUtmFromSearch,
} from "./client-contract";
import { analyticsPlacementPositionBounds } from "./taxonomy";

const VERSION_ID = "99999999-9999-4999-8999-999999999991";
const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const FEATURED_ID = "22222222-2222-4222-8222-222222222222";
const CONVERSATION_ID = "33333333-3333-4333-8333-333333333333";
const MEDIA_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEDIA_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("analytics client contract", () => {
  it("reads only the UTM allowlist from a search string", () => {
    const utm = selectedAnalyticsUtmFromSearch(
      "?utm_source=Newsletter&utm_medium=email&utm_campaign=launch_1&utm_content=hero&secret=1#frag",
    );
    assert.deepEqual(utm, {
      source: "newsletter",
      medium: "email",
      campaign: "launch_1",
    });
    assert.equal(JSON.stringify(utm).includes("secret"), false);
    assert.equal(JSON.stringify(utm).includes("hero"), false);
    assert.equal(JSON.stringify(utm).includes("frag"), false);
  });

  it("omits UTM when no allowlisted values are present", () => {
    assert.equal(selectedAnalyticsUtmFromSearch("?q=search+text&ref=https://evil.example"), undefined);
  });

  it("emits homepage slot placements only for displayed editorial assignments", () => {
    const placements = buildPublishedHomepageContentPlacements({
      homepageVersionId: "99999999-9999-4999-8999-999999999999",
      editorialSlots: {
        [HOMEPAGE_SLOT_KEY.LEAD]: LEAD_ID,
        [HOMEPAGE_SLOT_KEY.SUPPORT_1]: null,
        [HOMEPAGE_SLOT_KEY.SUPPORT_2]: null,
        [HOMEPAGE_SLOT_KEY.FEATURED_1]: FEATURED_ID,
        [HOMEPAGE_SLOT_KEY.FEATURED_2]: "44444444-4444-4444-8444-444444444444",
        [HOMEPAGE_SLOT_KEY.FEATURED_3]: null,
        [HOMEPAGE_SLOT_KEY.FEATURED_4]: null,
        [HOMEPAGE_SLOT_KEY.FEATURED_5]: null,
      },
      displayed: {
        lead: { contentItemId: LEAD_ID, publishedVersionId: VERSION_ID },
        supports: [],
        featured: [{ contentItemId: FEATURED_ID, publishedVersionId: VERSION_ID }],
      },
      conversation: [
        { rank: 1, contentItemId: CONVERSATION_ID, publishedVersionId: VERSION_ID },
        { rank: 2, contentItemId: null, publishedVersionId: null },
      ],
    });

    assert.deepEqual(placements, [
      {
        contentItemId: LEAD_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.LEAD,
        position: 1,
      },
      {
        contentItemId: FEATURED_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.FEATURED_1,
        position: 1,
      },
      {
        contentItemId: CONVERSATION_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.CONVERSATION,
        position: 1,
      },
    ]);
  });

  it("labels recency fallback stories without claiming builder slots", () => {
    const placements = buildPublishedHomepageContentPlacements({
      homepageVersionId: null,
      editorialSlots: null,
      displayed: {
        lead: { contentItemId: LEAD_ID, publishedVersionId: VERSION_ID },
        supports: [],
        featured: [],
      },
      conversation: [
        { rank: 1, contentItemId: CONVERSATION_ID, publishedVersionId: VERSION_ID },
      ],
    });
    assert.deepEqual(placements, [
      {
        contentItemId: LEAD_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
        position: 0,
      },
      {
        contentItemId: CONVERSATION_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.CONVERSATION,
        position: 1,
      },
    ]);
  });

  it("labels a substituted slot as recency fallback while other editorial slots stay canonical", () => {
    const RECENCY_SUB_ID = "55555555-5555-4555-8555-555555555555";
    const placements = buildPublishedHomepageContentPlacements({
      homepageVersionId: "99999999-9999-4999-8999-999999999999",
      editorialSlots: {
        [HOMEPAGE_SLOT_KEY.LEAD]: "66666666-6666-4666-8666-666666666666",
        [HOMEPAGE_SLOT_KEY.SUPPORT_1]: null,
        [HOMEPAGE_SLOT_KEY.SUPPORT_2]: null,
        [HOMEPAGE_SLOT_KEY.FEATURED_1]: FEATURED_ID,
        [HOMEPAGE_SLOT_KEY.FEATURED_2]: null,
        [HOMEPAGE_SLOT_KEY.FEATURED_3]: null,
        [HOMEPAGE_SLOT_KEY.FEATURED_4]: null,
        [HOMEPAGE_SLOT_KEY.FEATURED_5]: null,
      },
      displayed: {
        // editorialSlots.LEAD names a different contentItemId than what is
        // actually displayed (the picked story was unpublished/missing and
        // resolvePublicHomepagePlacements substituted a recency pick).
        lead: { contentItemId: RECENCY_SUB_ID, publishedVersionId: VERSION_ID },
        supports: [],
        featured: [{ contentItemId: FEATURED_ID, publishedVersionId: VERSION_ID }],
      },
      conversation: [],
    });

    assert.deepEqual(placements, [
      {
        contentItemId: RECENCY_SUB_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.RECENCY_FALLBACK,
        position: 0,
      },
      {
        contentItemId: FEATURED_ID,
        publishedVersionId: VERSION_ID,
        placement: ANALYTICS_PLACEMENT.FEATURED_1,
        position: 1,
      },
    ]);
  });

  it("keeps recency fallback positions deterministic and within bounds for a full slate", () => {
    const ids = Array.from(
      { length: 8 },
      (_, index) => `7${index}777777-7777-4777-8777-777777777777`,
    );
    const [leadId, support1Id, support2Id, f1, f2, f3, f4, f5] = ids;
    const placements = buildPublishedHomepageContentPlacements({
      homepageVersionId: null,
      editorialSlots: null,
      displayed: {
        lead: { contentItemId: leadId!, publishedVersionId: VERSION_ID },
        supports: [
          { contentItemId: support1Id!, publishedVersionId: VERSION_ID },
          { contentItemId: support2Id!, publishedVersionId: VERSION_ID },
        ],
        featured: [
          { contentItemId: f1!, publishedVersionId: VERSION_ID },
          { contentItemId: f2!, publishedVersionId: VERSION_ID },
          { contentItemId: f3!, publishedVersionId: VERSION_ID },
          { contentItemId: f4!, publishedVersionId: VERSION_ID },
          { contentItemId: f5!, publishedVersionId: VERSION_ID },
        ],
      },
      conversation: [],
    });

    assert.equal(placements.length, 8);
    assert.equal(
      placements.every((placement) => placement.placement === ANALYTICS_PLACEMENT.RECENCY_FALLBACK),
      true,
    );
    assert.deepEqual(
      placements.map((placement) => placement.position),
      [0, 1, 2, 3, 4, 5, 6, 7],
    );
    const bounds = analyticsPlacementPositionBounds(ANALYTICS_PLACEMENT.RECENCY_FALLBACK);
    for (const placement of placements) {
      assert.equal(placement.position >= bounds.min, true);
      assert.equal(placement.position <= bounds.max, true);
    }
  });

  it("opens a gallery on first interaction, then navigates and views the new image", () => {
    const first = galleryAnalyticsEmissions({
      opened: false,
      items: [{ mediaId: MEDIA_A }, { mediaId: MEDIA_B }],
      action: {
        method: ANALYTICS_GALLERY_NAVIGATION_METHOD.NEXT,
        fromIndex: 0,
        toIndex: 1,
      },
    });
    assert.deepEqual(
      first.emissions.map((event) => event.eventName),
      [
        ANALYTICS_EVENT_NAME.GALLERY_OPEN,
        ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE,
        ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW,
      ],
    );
    assert.equal(first.emissions[0]?.galleryPosition, 0);
    assert.equal(first.emissions[1]?.galleryPosition, 1);
    if (first.emissions[1]?.eventName === ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE) {
      assert.equal(
        first.emissions[1].navigationMethod,
        ANALYTICS_GALLERY_NAVIGATION_METHOD.NEXT,
      );
    }
    assert.equal(first.emissions[2]?.mediaId, MEDIA_B);

    const back = galleryAnalyticsEmissions({
      opened: true,
      items: [{ mediaId: MEDIA_A }, { mediaId: MEDIA_B }],
      action: {
        method: ANALYTICS_GALLERY_NAVIGATION_METHOD.PREV,
        fromIndex: 1,
        toIndex: 0,
      },
    });
    assert.deepEqual(
      back.emissions.map((event) => event.eventName),
      [ANALYTICS_EVENT_NAME.GALLERY_NAVIGATE, ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW],
    );
    assert.equal(back.emissions[1]?.mediaId, MEDIA_A);
  });

  it("does not treat the initial gallery image as an open or view", () => {
    const idle = galleryAnalyticsEmissions({
      opened: false,
      items: [{ mediaId: MEDIA_A }, { mediaId: MEDIA_B }],
      action: {
        method: ANALYTICS_GALLERY_NAVIGATION_METHOD.THUMB,
        fromIndex: 0,
        toIndex: 0,
      },
    });
    assert.equal(idle.emissions[0]?.eventName, ANALYTICS_EVENT_NAME.GALLERY_OPEN);
    assert.equal(idle.emissions.some((event) => event.eventName === ANALYTICS_EVENT_NAME.GALLERY_IMAGE_VIEW), false);
  });

  it("keeps impression thresholds in the shared policy, not component code", () => {
    assert.equal(ANALYTICS_IMPRESSION_POLICY.MIN_VISIBLE_RATIO, 0.5);
    assert.equal(ANALYTICS_IMPRESSION_POLICY.MIN_DWELL_MS, 250);
    assert.equal(VIDEO_PLAY_MEASUREMENT.STATUS, "DEFERRED");
  });
});
