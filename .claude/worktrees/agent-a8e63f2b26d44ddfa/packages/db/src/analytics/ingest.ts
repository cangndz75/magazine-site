import {
  ANALYTICS_ERROR,
  analyticsTimestampIsWithinWindow,
  bindAnalyticsWireContext,
  decideAcceptAnalyticsWireEvent,
  parseAnalyticsWireEvent,
  type AnalyticsDecision,
  type AnalyticsEvent,
  type AnalyticsIngestionContext,
} from "@magazine/domain";
import { persistAnalyticsEvent } from "./persist";
import { resolveAnalyticsEnrichmentSnapshot } from "./resolve";

export type IngestPublicAnalyticsEventResult = AnalyticsDecision<{
  event: AnalyticsEvent;
  outcome: "INSERTED" | "DEDUPLICATED";
}>;

export async function ingestPublicAnalyticsEvent(
  input: unknown,
  context: AnalyticsIngestionContext,
): Promise<IngestPublicAnalyticsEventResult> {
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

  const snapshot = await resolveAnalyticsEnrichmentSnapshot(
    parsed.value,
    bound.value,
  );
  if (!snapshot.ok) {
    return snapshot;
  }

  const accepted = decideAcceptAnalyticsWireEvent(input, context, snapshot.value);
  if (!accepted.ok) {
    return accepted;
  }

  const persisted = await persistAnalyticsEvent(accepted.value);
  if (persisted.outcome === "CONFLICT") {
    return { ok: false, code: ANALYTICS_ERROR.EVENT_ID_CONFLICT };
  }

  return {
    ok: true,
    value: {
      event: accepted.value,
      outcome: persisted.outcome,
    },
  };
}
