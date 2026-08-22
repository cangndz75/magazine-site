import { REDIRECT_ERROR } from "@magazine/domain";
import type { RedirectPageFilters } from "./page-params";

export function redirectEnabledLabel(enabled: boolean): string {
  return enabled ? "Etkin" : "Devre dışı";
}

export function redirectStatusBadgeVariant(enabled: boolean): "success" | "neutral" {
  return enabled ? "success" : "neutral";
}

export function redirectPreviewLabel(sourcePath: string, targetPath: string): string {
  return `${sourcePath} → ${targetPath}`;
}

export function redirectPageHasFilters(filters: RedirectPageFilters): boolean {
  return Boolean(filters.search) || filters.enabled !== null;
}

export function redirectAuditEnabledLabel(enabled: boolean | null): string {
  if (enabled === null) {
    return "—";
  }
  return redirectEnabledLabel(enabled);
}

export const REDIRECT_ERROR_MESSAGES: Record<string, string> = {
  [REDIRECT_ERROR.SOURCE_CONFLICT]:
    "Bu kaynak adres zaten kullanılıyor veya mevcut bir yayınla çakışıyor.",
  [REDIRECT_ERROR.TARGET_INVALID]:
    "Hedef adres geçerli bir public adres değil.",
  [REDIRECT_ERROR.SOURCE_INVALID]: "Kaynak adres geçersiz.",
  [REDIRECT_ERROR.REDIRECT_LOOP]: "Bu yönlendirme bir döngü oluşturur.",
  [REDIRECT_ERROR.REDIRECT_CHAIN]:
    "Bu yönlendirme zincir oluşturur; doğrudan hedef kullanın.",
  [REDIRECT_ERROR.WRITE_CONFLICT]:
    "Bu yönlendirme başka bir kullanıcı tarafından değiştirildi. Güncel veriyi yeniden yükleyin.",
  [REDIRECT_ERROR.SOURCE_EQUALS_TARGET]:
    "Kaynak ve hedef adres aynı olamaz.",
  [REDIRECT_ERROR.NOT_FOUND]: "Yönlendirme kuralı bulunamadı.",
  [REDIRECT_ERROR.FORBIDDEN]: "Bu işlem için yetkiniz yok.",
};
