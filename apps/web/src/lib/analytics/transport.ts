import type { AnalyticsClientEvent } from "@magazine/domain/analytics-client";

export const ANALYTICS_PUBLIC_INGEST_PATH = "/api/analytics/events";

export type AnalyticsTransport = (
  event: AnalyticsClientEvent,
  options?: { surviveNavigation?: boolean },
) => Promise<void> | void;

function encodeEvent(event: AnalyticsClientEvent): string {
  return JSON.stringify(event);
}

function postWithFetch(
  body: string,
  surviveNavigation: boolean,
): Promise<Response> {
  return fetch(ANALYTICS_PUBLIC_INGEST_PATH, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body,
    credentials: "same-origin",
    keepalive: surviveNavigation,
  });
}

function sendJsonBeacon(body: string): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }
  try {
    const payload = new Blob([body], { type: "application/json" });
    return navigator.sendBeacon(ANALYTICS_PUBLIC_INGEST_PATH, payload);
  } catch {
    return false;
  }
}

/**
 * Smallest robust browser delivery. Clicks prefer sendBeacon then keepalive
 * fetch so a following navigation can still deliver the same eventId.
 * Failures are swallowed. At-most one retry reuses the same payload/eventId.
 */
export async function deliverAnalyticsEvent(
  event: AnalyticsClientEvent,
  options: { surviveNavigation?: boolean } = {},
): Promise<void> {
  const body = encodeEvent(event);
  const surviveNavigation = options.surviveNavigation === true;

  if (surviveNavigation && sendJsonBeacon(body)) {
    return;
  }

  try {
    await postWithFetch(body, surviveNavigation);
  } catch {
    try {
      await postWithFetch(body, surviveNavigation);
    } catch {
      return;
    }
  }
}
