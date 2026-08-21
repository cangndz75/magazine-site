import {
  ANALYTICS_IMPRESSION_POLICY,
  impressionIdentity,
  videoImpressionIdentity,
  type AnalyticsPlacement,
} from "@magazine/domain/analytics-client";

export type ImpressionSchedule = {
  setTimer: (callback: () => void, delayMs: number) => unknown;
  clearTimer: (handle: unknown) => void;
};

export type ImpressionObserverLike = {
  observe: (target: Element) => void;
  unobserve: (target: Element) => void;
  disconnect: () => void;
};

const defaultSchedule: ImpressionSchedule = {
  setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const impressed = new Set<string>();

export function resetImpressionMemoryForTests(): void {
  impressed.clear();
}

export function observeAnalyticsImpression(input: {
  element: Element;
  identity: string;
  onImpressed: () => void;
  observerFactory?: (
    callback: IntersectionObserverCallback,
    options: IntersectionObserverInit,
  ) => ImpressionObserverLike;
  schedule?: ImpressionSchedule;
}): () => void {
  if (impressed.has(input.identity)) {
    return () => undefined;
  }

  const schedule = input.schedule ?? defaultSchedule;
  const threshold = ANALYTICS_IMPRESSION_POLICY.MIN_VISIBLE_RATIO;
  const dwellMs = ANALYTICS_IMPRESSION_POLICY.MIN_DWELL_MS;
  let dwellHandle: unknown = null;

  const callback: IntersectionObserverCallback = (entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) {
      return;
    }
    const visible = entry.isIntersecting && entry.intersectionRatio >= threshold;
    if (!visible) {
      if (dwellHandle !== null) {
        schedule.clearTimer(dwellHandle);
        dwellHandle = null;
      }
      return;
    }
    if (dwellHandle !== null || impressed.has(input.identity)) {
      return;
    }
    dwellHandle = schedule.setTimer(() => {
      dwellHandle = null;
      if (impressed.has(input.identity)) {
        return;
      }
      impressed.add(input.identity);
      observer.unobserve(input.element);
      input.onImpressed();
    }, dwellMs);
  };

  const factory =
    input.observerFactory ??
    ((cb, options) => new IntersectionObserver(cb, options));
  const observer = factory(callback, { threshold, root: null, rootMargin: "0px" });
  observer.observe(input.element);

  return () => {
    if (dwellHandle !== null) {
      schedule.clearTimer(dwellHandle);
    }
    observer.disconnect();
  };
}

export function homepageImpressionKey(input: {
  pageViewContextId: string;
  placement: AnalyticsPlacement;
  position: number;
  contentItemId: string;
}): string {
  return impressionIdentity(input);
}

export function videoImpressionKey(input: {
  pageViewContextId: string;
  placement: AnalyticsPlacement;
  videoAssetId: string;
}): string {
  return videoImpressionIdentity(input);
}
