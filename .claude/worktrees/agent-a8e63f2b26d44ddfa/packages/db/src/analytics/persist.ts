import { analyticsEvents } from "../schema/analytics-events";
import { getDb } from "../client";
import {
  analyticsEventFactFingerprint,
  toAnalyticsRawEventRecord,
  type AnalyticsEvent,
} from "@magazine/domain";
import { eq } from "drizzle-orm";

export type PersistAnalyticsEventResult =
  | { outcome: "INSERTED"; eventId: string }
  | { outcome: "DEDUPLICATED"; eventId: string }
  | { outcome: "CONFLICT"; eventId: string };

/**
 * Append-only insert. event_id uniqueness is the final idempotency authority.
 * Same fingerprint: DEDUPLICATED. Different fingerprint: CONFLICT.
 */
export async function persistAnalyticsEvent(
  event: AnalyticsEvent,
): Promise<PersistAnalyticsEventResult> {
  const factFingerprint = analyticsEventFactFingerprint(event);
  const record = toAnalyticsRawEventRecord(event, factFingerprint);
  const db = getDb();
  const inserted = await db
    .insert(analyticsEvents)
    .values({
      eventId: record.eventId,
      schemaVersion: record.schemaVersion,
      eventName: record.eventName,
      occurredAt: record.occurredAt,
      receivedAt: record.receivedAt,
      anonymousSessionId: record.anonymousSessionId,
      anonymousVisitorId: record.anonymousVisitorId,
      trafficKind: record.trafficKind,
      trafficSource: record.trafficSource,
      referrerHost: record.referrerHost,
      contentItemId: record.contentItemId,
      publishedVersionId: record.publishedVersionId,
      publicSlug: record.publicSlug,
      surface: record.surface,
      placement: record.placement,
      homepageVersionId: record.homepageVersionId,
      position: record.position,
      mediaId: record.mediaId,
      videoAssetId: record.videoAssetId,
      primaryCategoryId: record.primaryCategoryId,
      authorIds: record.authorIds,
      factFingerprint: record.factFingerprint,
      properties: record.properties,
    })
    .onConflictDoNothing({ target: analyticsEvents.eventId })
    .returning({ eventId: analyticsEvents.eventId });

  if (inserted.length === 0) {
    const [existing] = await db
      .select({ factFingerprint: analyticsEvents.factFingerprint })
      .from(analyticsEvents)
      .where(eq(analyticsEvents.eventId, record.eventId))
      .limit(1);
    if (existing?.factFingerprint === record.factFingerprint) {
      return { outcome: "DEDUPLICATED", eventId: record.eventId };
    }
    return { outcome: "CONFLICT", eventId: record.eventId };
  }

  return { outcome: "INSERTED", eventId: record.eventId };
}
