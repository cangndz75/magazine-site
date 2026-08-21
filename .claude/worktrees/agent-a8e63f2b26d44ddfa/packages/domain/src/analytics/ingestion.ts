import { ANALYTICS_CONSENT_POLICY } from "./policy";
import type { AnalyticsEvent } from "./events";
import { persistentAnalyticsIdentityAllowed } from "./events";
import {
  ANALYTICS_ERROR,
  analyticsTimestampIsWithinWindow,
  parseClientAnalyticsEvent,
  type AnalyticsDecision,
} from "./validation";
import {
  classifyAnalyticsTrafficKind,
  classifyAnalyticsTrafficSource,
} from "./traffic";
import { parseAnalyticsWireEvent } from "./wire";
import { bindAnalyticsWireContext } from "./context";
import {
  enrichAnalyticsEvent,
  type AnalyticsEnrichmentSnapshot,
  type AnalyticsIngestionContext,
} from "./enrichment";
import { analyticsEventLeaksSensitiveMaterial } from "./privacy";

export type { AnalyticsIngestionContext };

export type AcceptAnalyticsEventResult = AnalyticsDecision<AnalyticsEvent>;

/**
 * Pass 1 validation/classification without content authority resolution.
 * Public HTTP ingestion uses decideAcceptAnalyticsWireEvent.
 */
export function decideAcceptAnalyticsEvent(
  input: unknown,
  context: AnalyticsIngestionContext,
): AcceptAnalyticsEventResult {
  const parsed = parseClientAnalyticsEvent(input);
  if (!parsed.ok) {
    return parsed;
  }

  if (
    !analyticsTimestampIsWithinWindow({
      occurredAt: parsed.value.occurredAt,
      receivedAt: context.receivedAt,
    })
  ) {
    return { ok: false, code: ANALYTICS_ERROR.TIMESTAMP_OUT_OF_WINDOW };
  }

  const trafficKind = classifyAnalyticsTrafficKind({
    appEnv: context.appEnv,
    signals: context.trafficSignals,
  });
  const classified = classifyAnalyticsTrafficSource({
    referrerUrl: context.referrerUrl,
    trustedSiteOrigin: context.trustedSiteOrigin,
  });

  const sessionId = persistentAnalyticsIdentityAllowed(context.consentState)
    ? parsed.value.anonymousSessionId
    : null;

  const accepted = {
    ...parsed.value,
    receivedAt: context.receivedAt,
    anonymousVisitorId: null,
    anonymousSessionId: sessionId,
    trafficKind,
    trafficSource: classified.source,
    referrerHost: classified.referrerHost,
  } as AnalyticsEvent;

  return { ok: true, value: accepted };
}

export function decideAcceptAnalyticsWireEvent(
  input: unknown,
  context: AnalyticsIngestionContext,
  snapshot: AnalyticsEnrichmentSnapshot,
): AcceptAnalyticsEventResult {
  const parsed = parseAnalyticsWireEvent(input);
  if (!parsed.ok) {
    return parsed;
  }

  if (
    !analyticsTimestampIsWithinWindow({
      occurredAt: parsed.value.occurredAt,
      receivedAt: context.receivedAt,
    })
  ) {
    return { ok: false, code: ANALYTICS_ERROR.TIMESTAMP_OUT_OF_WINDOW };
  }

  const bound = bindAnalyticsWireContext({
    wire: parsed.value,
    signingKey: context.analyticsContextSigningKey,
  });
  if (!bound.ok) {
    return bound;
  }

  const enriched = enrichAnalyticsEvent(parsed.value, context, snapshot);
  if (!enriched.ok) {
    return enriched;
  }

  if (analyticsEventLeaksSensitiveMaterial(enriched.value.properties)) {
    return { ok: false, code: ANALYTICS_ERROR.SENSITIVE_MATERIAL };
  }
  if (
    typeof enriched.value === "object" &&
    enriched.value !== null &&
    "analyticsContext" in (enriched.value as object)
  ) {
    return { ok: false, code: ANALYTICS_ERROR.SENSITIVE_MATERIAL };
  }

  return enriched;
}

export const ANALYTICS_INGESTION_CONTRACT = {
  command: "acceptAnalyticsEvent",
  route: "POST /api/analytics/events",
  responsibilities: [
    "validate",
    "resolve authoritative dimensions",
    "classify traffic",
    "dedupe by eventId",
    "persist raw event",
    "enqueue/aggregate later",
  ],
  queueRequired: false,
  storage: "postgresql",
  batchIngestion: false,
  consentPolicy: ANALYTICS_CONSENT_POLICY,
  rateLimit: {
    application: "IN_MEMORY_DEFENSE_IN_DEPTH",
    productionControl: "cloudflare",
  },
} as const;
