const FIELD_LABELS: Record<string, string> = {
  title: "Başlık",
  subtitle: "Alt başlık",
  excerpt: "Spot",
  seoTitle: "SEO başlığı",
  seoDescription: "SEO açıklaması",
  canonicalUrl: "Canonical URL",
  robots: "Robots yönergesi",
  credibility: "Doğruluk durumu",
  credibilitySource: "Doğruluk kaynağı",
  source: "Kaynak",
  sourceOrganization: "Kaynak kuruluş",
  sourceUrl: "Kaynak URL",
  syndicated: "Ajans / sendikasyon",
  isMaterialUpdate: "Materyal güncelleme",
};

const CHANGE_TYPE_LABELS = {
  ADDED: "Eklendi",
  REMOVED: "Kaldırıldı",
  MODIFIED: "Değişti",
  MOVED: "Taşındı",
} as const;

export type DiffSummaryInput = {
  changed: boolean;
  scalarFieldsChanged: number;
  blocksAdded: number;
  blocksRemoved: number;
  blocksModified: number;
  blocksMoved: number;
  bodyDetailLimited: boolean;
  categoriesAdded: number;
  categoriesRemoved: number;
  primaryCategoryChanged: boolean;
  tagsAdded: number;
  tagsRemoved: number;
  entitiesChanged: boolean;
  mediaChanged: boolean;
  authorsChanged: boolean;
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? "Alan";
}

export function changeTypeLabel(
  changeType: keyof typeof CHANGE_TYPE_LABELS,
): string {
  return CHANGE_TYPE_LABELS[changeType];
}

export function presentDiffSummary(summary: DiffSummaryInput): string[] {
  if (!summary.changed) {
    return ["Bu iki sürüm arasında görünür bir fark yok."];
  }

  const lines: string[] = [];

  if (summary.scalarFieldsChanged > 0) {
    lines.push(
      summary.scalarFieldsChanged === 1
        ? "1 alan değişti."
        : `${summary.scalarFieldsChanged} alan değişti.`,
    );
  }

  const bodyParts: string[] = [];
  if (summary.blocksAdded > 0) {
    bodyParts.push(`${summary.blocksAdded} blok eklendi`);
  }
  if (summary.blocksRemoved > 0) {
    bodyParts.push(`${summary.blocksRemoved} blok kaldırıldı`);
  }
  if (summary.blocksModified > 0) {
    bodyParts.push(`${summary.blocksModified} blok değişti`);
  }
  if (summary.blocksMoved > 0) {
    bodyParts.push(`${summary.blocksMoved} blok taşındı`);
  }
  if (bodyParts.length > 0) {
    lines.push(`Metin: ${bodyParts.join(", ")}.`);
  }
  if (summary.bodyDetailLimited) {
    lines.push("Uzun metin karşılaştırması kısaltıldı.");
  }

  if (summary.primaryCategoryChanged) {
    lines.push("Ana kategori değişti.");
  }
  if (summary.categoriesAdded > 0 || summary.categoriesRemoved > 0) {
    lines.push("Kategori ilişkileri değişti.");
  }
  if (summary.tagsAdded > 0 || summary.tagsRemoved > 0) {
    lines.push("Etiketler değişti.");
  }
  if (summary.authorsChanged) {
    lines.push("Yazar bilgisi değişti.");
  }
  if (summary.entitiesChanged) {
    lines.push("İlişkili kişiler / konular değişti.");
  }
  if (summary.mediaChanged) {
    lines.push("Kapak ve bağlı medya değişti.");
  }

  return lines.length > 0 ? lines : ["Sürümler arasında fark var."];
}

export function formatBooleanDiff(value: string | boolean | null): string {
  if (typeof value === "boolean") {
    return value ? "Evet" : "Hayır";
  }
  if (value === null || value === "") {
    return "—";
  }
  return value;
}
