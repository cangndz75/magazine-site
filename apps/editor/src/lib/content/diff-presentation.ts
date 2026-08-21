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

export const DIFF_FIELD_GROUP = {
  CONTENT: "CONTENT",
  SEO: "SEO",
  SOURCE: "SOURCE",
} as const;

export type DiffFieldGroup = (typeof DIFF_FIELD_GROUP)[keyof typeof DIFF_FIELD_GROUP];

const FIELD_GROUPS: Record<string, DiffFieldGroup> = {
  title: DIFF_FIELD_GROUP.CONTENT,
  subtitle: DIFF_FIELD_GROUP.CONTENT,
  excerpt: DIFF_FIELD_GROUP.CONTENT,
  seoTitle: DIFF_FIELD_GROUP.SEO,
  seoDescription: DIFF_FIELD_GROUP.SEO,
  canonicalUrl: DIFF_FIELD_GROUP.SEO,
  robots: DIFF_FIELD_GROUP.SEO,
  credibility: DIFF_FIELD_GROUP.SOURCE,
  credibilitySource: DIFF_FIELD_GROUP.SOURCE,
  source: DIFF_FIELD_GROUP.SOURCE,
  sourceOrganization: DIFF_FIELD_GROUP.SOURCE,
  sourceUrl: DIFF_FIELD_GROUP.SOURCE,
  syndicated: DIFF_FIELD_GROUP.SOURCE,
  isMaterialUpdate: DIFF_FIELD_GROUP.SOURCE,
};

export function fieldGroup(field: string): DiffFieldGroup {
  return FIELD_GROUPS[field] ?? DIFF_FIELD_GROUP.CONTENT;
}

const CHANGE_TYPE_LABELS = {
  ADDED: "Eklendi",
  REMOVED: "Kaldırıldı",
  MODIFIED: "Değişti",
  MOVED: "Taşındı",
} as const;

/** Entity relation roles, in canonical repository order (SUBJECT/SECONDARY/MENTIONED). */
export const ENTITY_ROLE_LABELS: Record<string, string> = {
  SUBJECT: "Ana Konu",
  SECONDARY: "İlgili",
  MENTIONED: "Bahsedilen",
};

export function entityRoleLabel(role: string): string {
  return ENTITY_ROLE_LABELS[role] ?? role;
}

export const AUTHOR_ROLE_DIFF_LABELS: Record<string, string> = {
  AUTHOR: "Yazar",
  CONTRIBUTOR: "Katkıda bulunan",
};

export function authorRoleDiffLabel(role: string): string {
  return AUTHOR_ROLE_DIFF_LABELS[role] ?? role;
}

const MEDIA_ROLE_LABELS: Record<string, string> = {
  HERO: "Kahraman görsel",
  GALLERY: "Galeri",
  INLINE: "Metin içi",
};

export function mediaRoleLabel(role: string): string {
  return MEDIA_ROLE_LABELS[role] ?? role;
}

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
  videosChanged?: boolean;
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
  if (summary.videosChanged) {
    lines.push("Video değişti.");
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

export type DiffChangeCounts = {
  added: number;
  changed: number;
  removed: number;
};
