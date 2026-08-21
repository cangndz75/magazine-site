import { createHash } from "node:crypto";
import type { AnalyticsEvent } from "./events";

function canonicalizeJson(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const nested = record[key];
    if (nested !== undefined) {
      out[key] = canonicalizeJson(nested);
    }
  }
  return out;
}

/**
 * Immutable analytical fact. Excludes receivedAt, transport headers,
 * traffic classification, and session cookies so retries stay idempotent.
 */
export function analyticsEventFactCanonical(event: AnalyticsEvent): string {
  return JSON.stringify(
    canonicalizeJson({
      eventId: event.eventId,
      eventName: event.eventName,
      schemaVersion: event.schemaVersion,
      occurredAt: event.occurredAt.toISOString(),
      surface: event.surface,
      properties: event.properties,
    }),
  );
}

export function analyticsEventFactFingerprint(event: AnalyticsEvent): string {
  return createHash("sha256")
    .update(analyticsEventFactCanonical(event), "utf8")
    .digest("hex");
}
