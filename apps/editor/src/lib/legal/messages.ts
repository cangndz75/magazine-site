import { CONTENT_LEGAL_ERROR } from "@magazine/domain";

export type LegalMutationState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; message: string }
  | { kind: "error"; code: string; message: string };

export function presentLegalFailure(code: string | undefined): string {
  switch (code) {
    case CONTENT_LEGAL_ERROR.FORBIDDEN:
      return "Bu yasal işlem için yetkiniz yok.";
    case CONTENT_LEGAL_ERROR.CONTENT_WRITE_CONFLICT:
      return "İçerik başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin.";
    case CONTENT_LEGAL_ERROR.NOT_PUBLISHED:
      return "Bu işlem yalnızca yayın geçmişi olan içeriklerde uygulanabilir.";
    case CONTENT_LEGAL_ERROR.ALREADY_RETRACTED:
      return "Bu haber zaten geri çekilmiş.";
    case CONTENT_LEGAL_ERROR.ALREADY_TAKEN_DOWN:
      return "Bu içerik zaten hukuki olarak kaldırılmış.";
    case CONTENT_LEGAL_ERROR.LEGAL_HOLD_ALREADY_ACTIVE:
      return "Legal hold zaten aktif.";
    case CONTENT_LEGAL_ERROR.LEGAL_HOLD_NOT_ACTIVE:
      return "Aktif bir legal hold yok.";
    case CONTENT_LEGAL_ERROR.INVALID_NOTE:
      return "İç not veya kamu notu geçersiz.";
    case CONTENT_LEGAL_ERROR.INVALID_LEGAL_ACTION:
      return "Yasal işlem isteği geçersiz.";
    case CONTENT_LEGAL_ERROR.CONTENT_DELETED:
      return "İçerik bulunamadı.";
    default:
      return "Yasal işlem tamamlanamadı.";
  }
}

export function presentLegalSuccess(actionType: string, polarity?: string): string {
  if (actionType === "CORRECTION") {
    return "Düzeltme kaydedildi.";
  }
  if (actionType === "CLARIFICATION") {
    return "Açıklama kaydedildi.";
  }
  if (actionType === "RETRACTION") {
    return "Haber geri çekildi.";
  }
  if (actionType === "TAKEDOWN") {
    return "Hukuki kaldırma uygulandı.";
  }
  if (actionType === "LEGAL_HOLD" && polarity === "RELEASE") {
    return "Legal hold kaldırıldı.";
  }
  if (actionType === "LEGAL_HOLD") {
    return "Legal hold uygulandı.";
  }
  return "Yasal işlem kaydedildi.";
}
