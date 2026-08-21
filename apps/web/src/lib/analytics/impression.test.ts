import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ANALYTICS_IMPRESSION_POLICY, ANALYTICS_PLACEMENT } from "@magazine/domain/analytics-client";
import {
  homepageImpressionKey,
  observeAnalyticsImpression,
  resetImpressionMemoryForTests,
  type ImpressionObserverLike,
} from "./impression";

afterEach(() => {
  resetImpressionMemoryForTests();
});

function mockObserver() {
  let callback: IntersectionObserverCallback | null = null;
  const observer: ImpressionObserverLike & {
    trigger: (ratio: number) => void;
  } = {
    observe() {
      return;
    },
    unobserve() {
      return;
    },
    disconnect() {
      return;
    },
    trigger(ratio: number) {
      callback?.(
        [
          {
            isIntersecting: ratio >= ANALYTICS_IMPRESSION_POLICY.MIN_VISIBLE_RATIO,
            intersectionRatio: ratio,
            target: element,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      );
    },
  };
  const element = { id: "slot" } as unknown as Element;
  return {
    element,
    factory: (cb: IntersectionObserverCallback) => {
      callback = cb;
      return observer;
    },
    trigger: (ratio: number) => observer.trigger(ratio),
  };
}

function manualClock() {
  const timers = new Map<number, () => void>();
  let next = 1;
  return {
    schedule: {
      setTimer(callback: () => void) {
        const id = next;
        next += 1;
        timers.set(id, callback);
        return id;
      },
      clearTimer(handle: unknown) {
        timers.delete(handle as number);
      },
    },
    flush() {
      for (const callback of [...timers.values()]) {
        callback();
      }
      timers.clear();
    },
    pending() {
      return timers.size;
    },
  };
}

describe("homepage impression observer", () => {
  it("does not count an impression merely because observe was attached", () => {
    const observer = mockObserver();
    let count = 0;
    observeAnalyticsImpression({
      element: observer.element,
      identity: "one",
      onImpressed: () => {
        count += 1;
      },
      observerFactory: observer.factory,
    });
    assert.equal(count, 0);
  });

  it("emits once after the taxonomy visibility and dwell thresholds", () => {
    const observer = mockObserver();
    const clock = manualClock();
    let count = 0;
    observeAnalyticsImpression({
      element: observer.element,
      identity: homepageImpressionKey({
        pageViewContextId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        placement: ANALYTICS_PLACEMENT.LEAD,
        position: 1,
        contentItemId: "22222222-2222-4222-8222-222222222222",
      }),
      onImpressed: () => {
        count += 1;
      },
      observerFactory: observer.factory,
      schedule: clock.schedule,
    });

    observer.trigger(0.49);
    clock.flush();
    assert.equal(count, 0);

    observer.trigger(0.5);
    assert.equal(clock.pending() > 0, true);
    clock.flush();
    assert.equal(count, 1);

    observer.trigger(0.9);
    clock.flush();
    assert.equal(count, 1);
  });

  it("counts different placements independently", () => {
    const first = mockObserver();
    const second = mockObserver();
    const clock = manualClock();
    const seen: string[] = [];
    observeAnalyticsImpression({
      element: first.element,
      identity: "LEAD:1:a",
      onImpressed: () => seen.push("LEAD"),
      observerFactory: first.factory,
      schedule: clock.schedule,
    });
    observeAnalyticsImpression({
      element: second.element,
      identity: "FEATURED_1:1:b",
      onImpressed: () => seen.push("FEATURED_1"),
      observerFactory: second.factory,
      schedule: clock.schedule,
    });
    first.trigger(1);
    second.trigger(1);
    clock.flush();
    assert.deepEqual(seen, ["LEAD", "FEATURED_1"]);
  });
});
