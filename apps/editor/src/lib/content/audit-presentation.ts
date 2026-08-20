import {
  CONTENT_AUDIT_ACTOR_KIND,
  CONTENT_AUDIT_EVENT_TYPE,
  type ContentAuditBodySummary,
  type ContentAuditChangeSet,
  type ContentAuditEventType,
  type ContentAuditRelationSummary,
  type ContentAuditScalarChange,
  type ContentAuditScalarField,
  type ContentAuditScalarValue,
} from "@magazine/domain";

export type EditorAuditActor = {
  kind: "STAFF" | "SYSTEM";
  staffUserId: string | null;
  displayName: string | null;
};

export type EditorAuditEvent = {
  id: string;
  contentItemId: string;
  versionId: string | null;
  eventType: ContentAuditEventType;
  actor: EditorAuditActor;
  occurredAt: string;
  changeSet: ContentAuditChangeSet | null;
};

export type PresentedAuditEvent = {
  id: string;
  actorLabel: string;
  actorKindLabel: string;
  actionLabel: string;
  occurredAt: string;
  scalarChanges: PresentedScalarChange[];
  bodyChange: PresentedBodyChange | null;
  relationChanges: PresentedRelationChange[];
  detailLimited: boolean;
};

export type PresentedScalarChange = {
  fieldLabel: string;
  summary: string;
  before: string | null;
  after: string | null;
  multiline: boolean;
};

export type PresentedBodyChange = {
  label: string;
  detailLimited: boolean;
};

export type PresentedRelationChange = {
  label: string;
  summary: string;
  detailLimited: boolean;
};

export const AUDIT_HISTORY_TEXT = {
  title: "Geçmiş",
  subtitle: "Etkinlik geçmişi",
  loading: "Geçmiş yükleniyor.",
  empty: "Henüz geçmiş kaydı yok.",
  error: "Geçmiş yüklenemedi.",
  retry: "Tekrar dene",
  loadMore: "Daha eski etkinlikleri yükle",
  refreshing: "Geçmiş yenileniyor.",
  limited: "Değişiklik ayrıntıları boyut sınırı nedeniyle özetlendi.",
} as const;

const EVENT_LABELS: Record<ContentAuditEventType, string> = {
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_CREATED]: "Taslak oluşturuldu",
  [CONTENT_AUDIT_EVENT_TYPE.DRAFT_REVISION_CREATED]: "Yeni taslak sürüm oluşturuldu",
  [CONTENT_AUDIT_EVENT_TYPE.DRAFT_UPDATED]: "Taslak güncellendi",
  [CONTENT_AUDIT_EVENT_TYPE.REVIEW_SUBMITTED]: "İncelemeye gönderildi",
  [CONTENT_AUDIT_EVENT_TYPE.REVIEW_CHANGES_REQUESTED]: "Değişiklik istendi",
  [CONTENT_AUDIT_EVENT_TYPE.REVIEW_APPROVED]: "Onaylandı",
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_PUBLISHED]: "Yayınlandı",
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_UNPUBLISHED]: "Yayından kaldırıldı",
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_SCHEDULED]: "Yayın zamanlandı",
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_RESCHEDULED]: "Yayın zamanı değiştirildi",
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_SCHEDULE_CANCELLED]: "Zamanlama iptal edildi",
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_CORRECTION_RECORDED]: "Düzeltme kaydedildi",
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_CLARIFICATION_RECORDED]: "Açıklama kaydedildi",
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_RETRACTED]: "Geri çekildi",
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_TAKEN_DOWN]: "Yasal kaldırma uygulandı",
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_LEGAL_HOLD_PLACED]: "Legal hold konuldu",
  [CONTENT_AUDIT_EVENT_TYPE.CONTENT_LEGAL_HOLD_RELEASED]: "Legal hold kaldırıldı",
};

const FIELD_LABELS: Record<ContentAuditScalarField, string> = {
  title: "Başlık",
  subtitle: "Alt başlık",
  excerpt: "Spot",
  seoTitle: "SEO başlığı",
  seoDescription: "SEO açıklaması",
  canonicalUrl: "Canonical URL",
  robots: "Robots",
  credibility: "Güvenilirlik durumu",
  credibilitySource: "Doğrulama kaynağı",
  source: "Kaynak",
  sourceOrganization: "Kaynak kuruluş",
  sourceUrl: "Kaynak URL",
  syndicated: "Ajans / sendikasyon",
  isMaterialUpdate: "Önemli güncelleme",
};

const RELATION_LABELS: Record<ContentAuditRelationSummary["relation"], string> = {
  categories: "Kategori değişiklikleri",
  tags: "Etiket değişiklikleri",
  entities: "Kişi / entity değişiklikleri",
  media: "Medya değişiklikleri",
  videos: "Video değişiklikleri",
  authors: "Yazar değişiklikleri",
};

export function presentAuditEvent(event: EditorAuditEvent): PresentedAuditEvent {
  const changeSet = event.changeSet;
  return {
    id: event.id,
    actorLabel: actorLabel(event.actor),
    actorKindLabel:
      event.actor.kind === CONTENT_AUDIT_ACTOR_KIND.SYSTEM ? "Sistem" : "Personel",
    actionLabel: EVENT_LABELS[event.eventType],
    occurredAt: event.occurredAt,
    scalarChanges: (changeSet?.scalarChanges ?? []).map(presentScalarChange),
    bodyChange: changeSet?.bodyChange
      ? presentBodyChange(changeSet.bodyChange)
      : null,
    relationChanges: (changeSet?.relationChanges ?? [])
      .filter((change) => change.changed)
      .map(presentRelationChange),
    detailLimited: changeSet?.detailLimited === true,
  };
}

export function mergeAuditEvents(
  current: readonly EditorAuditEvent[],
  incoming: readonly EditorAuditEvent[],
): EditorAuditEvent[] {
  const seen = new Set<string>();
  return [...current, ...incoming].filter((event) => {
    if (seen.has(event.id)) {
      return false;
    }
    seen.add(event.id);
    return true;
  });
}

function actorLabel(actor: EditorAuditActor): string {
  if (actor.kind === CONTENT_AUDIT_ACTOR_KIND.SYSTEM) {
    return "Sistem";
  }
  return nonEmpty(actor.displayName) ?? "Staff";
}

function presentScalarChange(change: ContentAuditScalarChange): PresentedScalarChange {
  const fieldLabel = FIELD_LABELS[change.field];
  const before = scalarValueLabel(change.before);
  const after = scalarValueLabel(change.after);
  const multiline = isLongValue(before) || isLongValue(after);

  return {
    fieldLabel,
    summary: scalarSummary(fieldLabel, change.before, change.after),
    before,
    after,
    multiline,
  };
}

function presentBodyChange(change: ContentAuditBodySummary): PresentedBodyChange {
  return {
    label: change.changed ? "İçerik gövdesi değiştirildi" : "İçerik gövdesi",
    detailLimited: change.detailLimited,
  };
}

function presentRelationChange(
  change: ContentAuditRelationSummary,
): PresentedRelationChange {
  return {
    label: RELATION_LABELS[change.relation],
    summary: `${change.beforeCount} → ${change.afterCount}`,
    detailLimited: change.detailLimited,
  };
}

function scalarSummary(
  fieldLabel: string,
  before: ContentAuditScalarValue,
  after: ContentAuditScalarValue,
): string {
  if (before === null && after !== null) {
    return `${fieldLabel} eklendi`;
  }
  if (before !== null && after === null) {
    return `${fieldLabel} kaldırıldı`;
  }
  return `${fieldLabel} değiştirildi`;
}

function scalarValueLabel(value: ContentAuditScalarValue): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? "Açık" : "Kapalı";
  }
  return value;
}

function isLongValue(value: string | null): boolean {
  return Boolean(value && value.length > 80);
}

function nonEmpty(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
