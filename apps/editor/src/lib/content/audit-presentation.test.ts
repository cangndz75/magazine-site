import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONTENT_AUDIT_EVENT_TYPE } from "@magazine/domain";
import {
  AUDIT_HISTORY_TEXT,
  mergeAuditEvents,
  presentAuditEvent,
  type EditorAuditEvent,
} from "./audit-presentation";

const baseEvent: EditorAuditEvent = {
  id: "event-1",
  contentItemId: "content-1",
  versionId: "version-1",
  eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_CREATED,
  actor: {
    kind: "STAFF",
    staffUserId: "staff-1",
    displayName: "Can",
  },
  occurredAt: "2026-08-17T02:14:00.000Z",
  changeSet: null,
};

describe("audit timeline presentation", () => {
  it("maps all audit event types to Turkish labels", () => {
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_CREATED,
      }).actionLabel,
      "Taslak oluşturuldu",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.DRAFT_REVISION_CREATED,
      }).actionLabel,
      "Yeni taslak sürüm oluşturuldu",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.DRAFT_UPDATED,
      }).actionLabel,
      "Taslak güncellendi",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.REVIEW_SUBMITTED,
      }).actionLabel,
      "İncelemeye gönderildi",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.REVIEW_CHANGES_REQUESTED,
      }).actionLabel,
      "Değişiklik istendi",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.REVIEW_APPROVED,
      }).actionLabel,
      "Onaylandı",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_PUBLISHED,
      }).actionLabel,
      "Yayınlandı",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_UNPUBLISHED,
      }).actionLabel,
      "Yayından kaldırıldı",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_SCHEDULED,
      }).actionLabel,
      "Yayın zamanlandı",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_RESCHEDULED,
      }).actionLabel,
      "Yayın zamanı değiştirildi",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_SCHEDULE_CANCELLED,
      }).actionLabel,
      "Zamanlama iptal edildi",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_CORRECTION_RECORDED,
      }).actionLabel,
      "Düzeltme kaydedildi",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_CLARIFICATION_RECORDED,
      }).actionLabel,
      "Açıklama kaydedildi",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_RETRACTED,
      }).actionLabel,
      "Geri çekildi",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_TAKEN_DOWN,
      }).actionLabel,
      "Yasal kaldırma uygulandı",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_LEGAL_HOLD_PLACED,
      }).actionLabel,
      "Legal hold konuldu",
    );
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_LEGAL_HOLD_RELEASED,
      }).actionLabel,
      "Legal hold kaldırıldı",
    );
  });

  it("renders staff and system actors without fake users", () => {
    assert.equal(presentAuditEvent(baseEvent).actorLabel, "Can");
    assert.equal(
      presentAuditEvent({
        ...baseEvent,
        actor: { kind: "SYSTEM", staffUserId: null, displayName: null },
      }).actorLabel,
      "Sistem",
    );
  });

  it("renders scalar changes with editorial labels and values", () => {
    const event = presentAuditEvent({
      ...baseEvent,
      changeSet: {
        scalarChanges: [
          { field: "title", before: "Eski başlık", after: "Yeni başlık" },
          { field: "sourceUrl", before: null, after: "https://example.test" },
          { field: "excerpt", before: "Kaldırılan spot", after: null },
          { field: "isMaterialUpdate", before: false, after: true },
        ],
      },
    });

    assert.deepEqual(
      event.scalarChanges.map((change) => change.summary),
      [
        "Başlık değiştirildi",
        "Kaynak URL eklendi",
        "Spot kaldırıldı",
        "Önemli güncelleme değiştirildi",
      ],
    );
    assert.equal(event.scalarChanges[3]?.before, "Kapalı");
    assert.equal(event.scalarChanges[3]?.after, "Açık");
    assert.equal(event.scalarChanges.some((change) => change.before === "null"), false);
  });

  it("renders multiple scalar fields and long text as multiline", () => {
    const event = presentAuditEvent({
      ...baseEvent,
      changeSet: {
        scalarChanges: [
          {
            field: "seoDescription",
            before: "Kısa",
            after:
              "Bu açıklama uzun olduğu için tarihçe yüzeyinde kompakt çok satırlı gösterilir ve editöre taşmadan okunur.",
          },
          { field: "robots", before: "noindex", after: "index,follow" },
        ],
      },
    });

    assert.equal(event.scalarChanges.length, 2);
    assert.equal(event.scalarChanges[0]?.fieldLabel, "SEO açıklaması");
    assert.equal(event.scalarChanges[0]?.multiline, true);
  });

  it("renders body and detail-limited summaries without raw JSON", () => {
    const event = presentAuditEvent({
      ...baseEvent,
      changeSet: {
        bodyChange: { changed: true, detailLimited: true },
        detailLimited: true,
      },
    });

    assert.equal(event.bodyChange?.label, "İçerik gövdesi değiştirildi");
    assert.equal(event.bodyChange?.detailLimited, true);
    assert.equal(event.detailLimited, true);
  });

  it("renders bounded relation summaries", () => {
    const event = presentAuditEvent({
      ...baseEvent,
      changeSet: {
        relationChanges: [
          {
            relation: "categories",
            beforeCount: 1,
            afterCount: 2,
            changed: true,
            detailLimited: true,
          },
          {
            relation: "tags",
            beforeCount: 1,
            afterCount: 1,
            changed: false,
            detailLimited: false,
          },
        ],
      },
    });

    assert.equal(event.relationChanges.length, 1);
    assert.equal(event.relationChanges[0]?.label, "Kategori değişiklikleri");
    assert.equal(event.relationChanges[0]?.summary, "1 → 2");
  });

  it("exposes deterministic loading, empty, error, and pagination labels", () => {
    assert.equal(AUDIT_HISTORY_TEXT.loading, "Geçmiş yükleniyor.");
    assert.equal(AUDIT_HISTORY_TEXT.empty, "Henüz geçmiş kaydı yok.");
    assert.equal(AUDIT_HISTORY_TEXT.error, "Geçmiş yüklenemedi.");
    assert.equal(AUDIT_HISTORY_TEXT.loadMore, "Daha eski etkinlikleri yükle");
  });

  it("appends older pages without duplicate timeline rows", () => {
    const merged = mergeAuditEvents(
      [baseEvent, { ...baseEvent, id: "event-2" }],
      [{ ...baseEvent, id: "event-2" }, { ...baseEvent, id: "event-3" }],
    );

    assert.deepEqual(
      merged.map((event) => event.id),
      ["event-1", "event-2", "event-3"],
    );
  });
});
