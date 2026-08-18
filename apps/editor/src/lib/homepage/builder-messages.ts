import { HOMEPAGE_BUILDER_ERROR } from "@magazine/domain";

export const HOMEPAGE_BUILDER_CONFLICT_MESSAGE =
  "Ana sayfa taslağı başka bir oturumda değiştirildi. Güncel taslağı yükleyip tekrar deneyin.";

const MESSAGES: Record<string, string> = {
  [HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT]: HOMEPAGE_BUILDER_CONFLICT_MESSAGE,
  [HOMEPAGE_BUILDER_ERROR.FORBIDDEN]: "Bu işlem için yetkin yok.",
  [HOMEPAGE_BUILDER_ERROR.DUPLICATE_CONTENT_ITEM]:
    "Aynı haber ana sayfada birden fazla slotta kullanılamaz.",
  [HOMEPAGE_BUILDER_ERROR.INVALID_CONTENT_ITEM]: "Seçilen içerik bulunamadı.",
  [HOMEPAGE_BUILDER_ERROR.INVALID_SLOT]: "Geçersiz slot.",
  [HOMEPAGE_BUILDER_ERROR.PUBLISH_VALIDATION_FAILED]:
    "Taslak yayınlanamaz: bazı atamalar henüz yayında değil veya geçersiz.",
  [HOMEPAGE_BUILDER_ERROR.NO_DRAFT]: "Düzenlenebilir taslak bulunamadı.",
};

export function presentHomepageBuilderError(code: string | undefined): string {
  if (!code) {
    return "İşlem tamamlanamadı. Tekrar deneyin.";
  }
  return MESSAGES[code] ?? "İşlem tamamlanamadı. Tekrar deneyin.";
}

export function isHomepageBuilderConflict(code: string | undefined): boolean {
  return code === HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT;
}
