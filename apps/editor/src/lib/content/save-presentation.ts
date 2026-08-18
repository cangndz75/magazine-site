export type SaveFailurePresentation = {
  kind: "conflict" | "error";
  message: string;
};

const CONFLICT_MESSAGE =
  "Bu içerik başka bir oturumda güncellendi. Değişikliklerin kaybolmadı; sayfayı yenileyip son sürümle karşılaştırman gerekiyor.";

const GENERIC_SAVE_MESSAGE = "Kayıt sırasında beklenmeyen bir hata oluştu.";

const SAVE_ERROR_MESSAGES: Record<string, string> = {
  CATEGORY_OUT_OF_SCOPE:
    "Seçilen kategori yetki alanınızın dışında. Taslak kaydedilmedi.",
  RELATION_NOT_FOUND:
    "Seçilen kategori, etiket, yazar, varlık veya medya artık mevcut değil. Taslak kaydedilmedi.",
  DUPLICATE_RELATION: "Aynı ilişki iki kez eklenemez.",
  INVALID_RELATION: "İlişki bilgisi geçersiz. Taslak kaydedilmedi.",
  MULTIPLE_PRIMARY_CATEGORIES: "Yalnızca bir ana kategori seçilebilir.",
  MULTIPLE_HERO_MEDIA: "Yalnızca bir kapak görseli seçilebilir.",
  CONTENT_NOT_FOUND: "İçerik bulunamadı.",
  VERSION_NOT_FOUND: "Sürüm bulunamadı.",
};

export function presentSaveFailure(
  code: string | undefined,
  fallbackMessage?: string,
): SaveFailurePresentation {
  if (code === "CONTENT_WRITE_CONFLICT") {
    return { kind: "conflict", message: CONFLICT_MESSAGE };
  }

  if (code && SAVE_ERROR_MESSAGES[code]) {
    return { kind: "error", message: SAVE_ERROR_MESSAGES[code] };
  }

  return {
    kind: "error",
    message: fallbackMessage || GENERIC_SAVE_MESSAGE,
  };
}

export function isSuccessfulSaveResponse(input: {
  okHttp: boolean;
  okBody: boolean;
  hasData: boolean;
}): boolean {
  return input.okHttp && input.okBody && input.hasData;
}
