import {
  ENTITY_AUDIT_EVENT_TYPE,
  ENTITY_ERROR,
  ENTITY_STATUS,
  type EntityKind,
  type EntityStatus,
} from "@magazine/domain";
import { ENTITY_KIND_LABELS } from "@/lib/content/lookup-labels";

export function entityKindLabel(kind: EntityKind | string): string {
  return ENTITY_KIND_LABELS[kind] ?? "Varlık";
}

export function entityStatusLabel(status: EntityStatus | string): string {
  switch (status) {
    case ENTITY_STATUS.DRAFT:
      return "Taslak";
    case ENTITY_STATUS.ACTIVE:
      return "Aktif";
    case ENTITY_STATUS.ARCHIVED:
      return "Arşiv";
    default:
      return status;
  }
}

export function entityAuditEventLabel(eventType: string): string {
  switch (eventType) {
    case ENTITY_AUDIT_EVENT_TYPE.ENTITY_CREATED:
      return "Oluşturuldu";
    case ENTITY_AUDIT_EVENT_TYPE.ENTITY_UPDATED:
      return "Güncellendi";
    case ENTITY_AUDIT_EVENT_TYPE.ENTITY_SLUG_CHANGED:
      return "URL değişti";
    case ENTITY_AUDIT_EVENT_TYPE.ENTITY_ARCHIVED:
      return "Arşivlendi";
    case ENTITY_AUDIT_EVENT_TYPE.ENTITY_REACTIVATED:
      return "Yeniden etkinleştirildi";
    default:
      return eventType;
  }
}

export function presentEntityAdminFailure(code: string | undefined): {
  message: string;
  isConflict: boolean;
} {
  switch (code) {
    case ENTITY_ERROR.FORBIDDEN:
    case "FORBIDDEN":
      return {
        message: "Bu işlem için yetkiniz yok.",
        isConflict: false,
      };
    case ENTITY_ERROR.ENTITY_NOT_FOUND:
      return {
        message: "Varlık kaydı bulunamadı.",
        isConflict: false,
      };
    case ENTITY_ERROR.ENTITY_WRITE_CONFLICT:
      return {
        message:
          "Bu kayıt başka bir kullanıcı tarafından güncellendi. Son sürümü yükleyip değişikliklerinizi yeniden kontrol edin.",
        isConflict: true,
      };
    case ENTITY_ERROR.SLUG_CONFLICT:
      return {
        message: "Bu URL başka bir varlıkta kullanılıyor.",
        isConflict: false,
      };
    case ENTITY_ERROR.INVALID_SLUG:
      return {
        message: "URL geçersiz.",
        isConflict: false,
      };
    case ENTITY_ERROR.INVALID_NAME:
      return {
        message: "Ad geçersiz.",
        isConflict: false,
      };
    case ENTITY_ERROR.INVALID_ALIAS:
    case ENTITY_ERROR.DUPLICATE_ALIAS:
      return {
        message: "Takma ad geçersiz veya tekrar ediyor.",
        isConflict: false,
      };
    case ENTITY_ERROR.INVALID_MEDIA:
      return {
        message: "Seçilen portre geçerli bir görsel olmalıdır.",
        isConflict: false,
      };
    case ENTITY_ERROR.INVALID_STATUS:
      return {
        message: "Bu durum geçişi şu an için uygun değil.",
        isConflict: false,
      };
    case ENTITY_ERROR.INVALID_PROFILE:
    case ENTITY_ERROR.INVALID_URL:
    case ENTITY_ERROR.INVALID_KIND:
      return {
        message: "Profil bilgileri geçersiz.",
        isConflict: false,
      };
    default:
      return {
        message: "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
        isConflict: false,
      };
  }
}
