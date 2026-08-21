import { PUBLICATION_STATUS, type PublicationStatus } from "@magazine/domain";

export function presentSlugMutationCopy(publicationStatus: PublicationStatus): {
  submitLabel: string;
  requiresConsequence: boolean;
  consequenceLabel: string;
  publishedWarning: string;
} {
  return {
    submitLabel:
      publicationStatus === PUBLICATION_STATUS.PUBLISHED
        ? "URL'yi değiştir ve eski adresi yönlendir"
        : "URL'yi kaydet",
    requiresConsequence: publicationStatus === PUBLICATION_STATUS.PUBLISHED,
    consequenceLabel:
      "Eski adres kalıcı olarak yeni adrese yönlendirilecek. Bu işlem geri alınamaz.",
    publishedWarning:
      "Yayındaki yazının adresi değişecek. Eski URL ziyaretçileri yeni adrese kalıcı olarak yönlendirilir.",
  };
}

export const SLUG_CONFLICT_MESSAGE = "Bu URL kullanımda.";
export const INVALID_SLUG_MESSAGE = "URL geçersiz.";
