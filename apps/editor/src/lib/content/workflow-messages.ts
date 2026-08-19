import { isSuccessfulSaveResponse } from "./save-presentation";

export type WorkflowMutationState =
  | { kind: "idle" }
  | { kind: "pending"; action: string }
  | { kind: "success"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "error"; message: string };

const CONFLICT_MESSAGE =
  "Bu içerik başka bir oturumda güncellendi. İşlem uygulanmadı. Sayfayı yenileyip güncel sürümle devam et.";

const MESSAGES: Record<string, string> = {
  CONTENT_WRITE_CONFLICT: CONFLICT_MESSAGE,
  FORBIDDEN: "Bu işlem için yetkin yok.",
  INVALID_WORKFLOW_TRANSITION: "Bu sürüm şu anda bu işleme uygun değil.",
  VERSION_NOT_CURRENT_DRAFT: "İşlem yalnızca güncel taslak sürüm üzerinde yapılabilir.",
  VERSION_NOT_APPROVED: "Yayınlamak veya zamanlamak için sürümün onaylanmış olması gerekir.",
  INVALID_PUBLISH_TARGET: "Bu sürüm şu anda yayınlanamaz.",
  PUBLISH_READINESS_FAILED: "Yayın için ana kategori eksik veya geçersiz.",
  SCHEDULE_NOT_IN_FUTURE: "Zamanlama şu andan sonra bir tarih ve saat olmalı.",
  ALREADY_SCHEDULED: "Bu içerik zaten zamanlanmış. Önce zamanlamayı değiştir veya iptal et.",
  NO_SCHEDULE: "İptal edilecek bir zamanlama yok.",
  CANNOT_SCHEDULE_PUBLISHED_VERSION: "Yayındaki sürüm yeniden zamanlanamaz.",
  INVALID_REVIEW_NOTE: "Değişiklik isteği için 3 ile 4000 karakter arasında bir gerekçe yaz.",
  CATEGORY_OUT_OF_SCOPE: "Bu içerik senin kategori kapsamının dışında.",
  VERSION_NOT_EDITABLE: "Bu sürüm düzenlenemez veya incelemeye gönderilemez.",
  INVALID_REQUEST: "İstek geçersiz. Tarihi ve gerekli alanları kontrol et.",
  DRAFT_ALREADY_EXISTS:
    "Bu içerik için zaten bir taslak var. İşlem uygulanmadı. Sayfayı yenileyip o taslakla devam et.",
  NO_REVISION_SOURCE: "Yeni taslak için kullanılacak bir kaynak sürüm yok.",
  NOT_PUBLISHED: "Bu içerik şu anda yayında değil. Yayından kaldırma uygulanmadı.",
  CONTENT_NOT_FOUND: "İçerik bulunamadı veya senin kapsamının dışında.",
  VERSION_NOT_FOUND: "Sürüm bulunamadı.",
};

const SUCCESS: Record<string, string> = {
  "submit-review": "Sürüm incelemeye gönderildi.",
  approve: "Sürüm onaylandı. Yayın ayrı bir adımdır.",
  "request-changes": "Değişiklik istendi. Sürüm yeniden taslağa alındı.",
  publish: "Sürüm yayınlandı.",
  schedule: "Sürüm zamanlandı.",
  reschedule: "Yayın zamanı güncellendi.",
  unschedule: "Zamanlama iptal edildi. Sürüm çalışma alanında duruyor.",
  "create-revision": "Yeni taslak oluşturuldu. Yayındaki sürüm değişmedi.",
  unpublish: "Haber yayından kaldırıldı. İçerik ve geçmiş korundu.",
};

export function presentWorkflowFailure(
  code: string | undefined,
): Extract<WorkflowMutationState, { kind: "conflict" | "error" }> {
  if (code === "CONTENT_WRITE_CONFLICT" || code === "DRAFT_ALREADY_EXISTS") {
    return {
      kind: "conflict",
      message: (code && MESSAGES[code]) || CONFLICT_MESSAGE,
    };
  }

  return {
    kind: "error",
    message: (code && MESSAGES[code]) || "İşlem tamamlanamadı. Tekrar dene.",
  };
}

export function presentWorkflowSuccess(action: string): string {
  return SUCCESS[action] ?? "İşlem tamamlandı.";
}

export function isSuccessfulWorkflowResponse(input: {
  okHttp: boolean;
  okBody: boolean;
  hasData: boolean;
}): boolean {
  return isSuccessfulSaveResponse(input);
}

export function parseWorkflowErrorCode(body: {
  ok?: boolean;
  error?: { code?: string };
}): string | undefined {
  return body.error?.code;
}
