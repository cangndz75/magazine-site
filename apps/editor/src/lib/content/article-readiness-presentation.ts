import {
  READINESS_OVERALL_STATE,
  READINESS_SECTION,
  READINESS_SECTION_STATE,
  type ArticleReadinessDTO,
  type ReadinessIssue,
  type ReadinessSectionId,
  type ReadinessSectionState,
} from "@magazine/domain";
import {
  presentDiscoverFinding,
  presentSeoFinding,
} from "@/lib/seo/presentation";

export const READINESS_ISSUE_LABELS: Record<string, string> = {
  LEGAL_HOLD: "Legal hold aktif; yayın işlemleri engellendi.",
  LEGAL_WITHDRAWAL: "Hukuki geri çekme veya kaldırma nedeniyle yayın engellendi.",
  IN_REVIEW: "Sürüm inceleme bekliyor.",
  DRAFT: "Sürüm henüz onaylandı değil.",
  VERSION_NOT_APPROVED: "Yayın için sürüm onaylanmalı.",
  PUBLISH_READINESS_FAILED: "Yayın için ana kategori gerekir.",
  TITLE_MISSING: "Başlık zorunlu.",
  BODY_EMPTY: "Gövde metni gerekli.",
  BODY_UNINSPECTABLE: "Gövde güvenli şekilde doğrulanamıyor.",
  PRIMARY_CATEGORY_MISSING: "Ana kategori seçilmedi.",
  AUTHOR_MISSING: "Yazar atanmadı.",
  HERO_MISSING: "Kapak görseli seçilmedi.",
  HERO_ALT_MISSING: "Kapak görseli alt metni eksik.",
  HERO_PUBLIC_URL_MISSING: "Kapak kamu önizlemesi hazır değil.",
  HERO_RIGHTS_INELIGIBLE: "Kapak görseli kamu kullanımına uygun değil.",
  HERO_RIGHTS_UNKNOWN: "Kapak görseli hak durumu doğrulanamadı.",
  ENTITY_ARCHIVED: "Arşivlenmiş varlık ilişkisi var.",
  LINK_SUGGESTIONS_PENDING: "İncelenmemiş iç bağlantı önerisi var.",
  LINK_SUGGESTIONS_AMBIGUOUS: "Belirsiz eşleşme seçim bekliyor.",
  RETRACTION: "Haber geri çekildi.",
  TAKEDOWN: "Hukuki kaldırma uygulandı.",
  FIELD_VALIDATION_FAILED: "Bazı alanlar doğrulamadan geçmedi.",
};

export function presentReadinessIssueLabel(issue: ReadinessIssue): string {
  const mapped = READINESS_ISSUE_LABELS[issue.code];
  if (mapped) {
    return mapped;
  }

  if (issue.targetSection === READINESS_SECTION.SEO) {
    const seo = presentSeoFinding({
      code: issue.code as never,
      severity: "WARNING",
      kind: "EDITORIAL",
      message: issue.label,
    });
    if (seo.title) {
      return seo.title;
    }
    const discover = presentDiscoverFinding({
      code: issue.code as never,
      classification: "RECOMMENDATION",
      message: issue.label,
    });
    if (discover.title) {
      return discover.title;
    }
  }

  return issue.label;
}

export function presentArticleReadiness(
  readiness: ArticleReadinessDTO,
): ArticleReadinessDTO {
  const mapIssue = (issue: ReadinessIssue): ReadinessIssue => ({
    ...issue,
    label: presentReadinessIssueLabel(issue),
  });

  const sections = readiness.sections.map((section) => ({
    ...section,
    issues: section.issues.map(mapIssue),
  }));

  return {
    ...readiness,
    sections,
    blockingIssues: readiness.blockingIssues.map(mapIssue),
    warnings: readiness.warnings.map(mapIssue),
  };
}

export const READINESS_SECTION_LABELS: Record<ReadinessSectionId, string> = {
  [READINESS_SECTION.PUBLICATION]: "Yayın",
  [READINESS_SECTION.SEO]: "SEO",
  [READINESS_SECTION.CONTENT]: "İçerik",
  [READINESS_SECTION.MEDIA]: "Medya",
  [READINESS_SECTION.RIGHTS]: "Haklar",
  [READINESS_SECTION.ENTITIES]: "Varlıklar",
  [READINESS_SECTION.LEGAL]: "Yasal / Güvenilirlik",
};

export const READINESS_SECTION_TARGETS: Record<ReadinessSectionId, string> = {
  [READINESS_SECTION.PUBLICATION]: "editor-section-publication",
  [READINESS_SECTION.SEO]: "editor-section-seo",
  [READINESS_SECTION.CONTENT]: "editor-section-content",
  [READINESS_SECTION.MEDIA]: "editor-section-media",
  [READINESS_SECTION.RIGHTS]: "editor-section-media",
  [READINESS_SECTION.ENTITIES]: "editor-section-entities",
  [READINESS_SECTION.LEGAL]: "editor-section-legal",
};

export const READINESS_STATE_LABELS: Record<ReadinessSectionState, string> = {
  [READINESS_SECTION_STATE.READY]: "Hazır",
  [READINESS_SECTION_STATE.NEEDS_ATTENTION]: "Kontrol edilmeli",
  [READINESS_SECTION_STATE.BLOCKED]: "Engelli",
  [READINESS_SECTION_STATE.NOT_APPLICABLE]: "Uygulanmaz",
};

export function presentReadinessSummary(readiness: ArticleReadinessDTO): string {
  const { summary, overallState } = readiness;

  if (overallState === READINESS_OVERALL_STATE.BLOCKED) {
    return `${summary.blockingIssueCount} yayın engeli var`;
  }

  if (overallState === READINESS_OVERALL_STATE.READY) {
    return "Yayın için hazır";
  }

  return `${summary.readyCount} alan hazır · ${summary.attentionCount} alan kontrol edilmeli`;
}

export function presentReadinessSectionState(
  state: ReadinessSectionState,
): string {
  return READINESS_STATE_LABELS[state];
}

export type EditorSectionNavItem = {
  id: string;
  label: string;
};

export const EDITOR_SECTION_NAV: EditorSectionNavItem[] = [
  { id: "editor-section-content", label: "İçerik" },
  { id: "editor-section-media", label: "Medya" },
  { id: "editor-section-classification", label: "Sınıflandırma" },
  { id: "editor-section-entities", label: "Varlıklar" },
  { id: "editor-section-seo", label: "SEO" },
  { id: "editor-section-publication", label: "Yayın" },
];

export type SavePresentationState =
  | { kind: "clean" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; message: string }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string };

export function presentSaveState(input: {
  isDirty: boolean;
  isSaving: boolean;
  saveKind: "idle" | "saved" | "conflict" | "error";
  saveMessage?: string;
}): SavePresentationState {
  if (input.isSaving) {
    return { kind: "saving" };
  }
  if (input.saveKind === "conflict") {
    return {
      kind: "conflict",
      message:
        input.saveMessage ??
        "Bu içerik başka bir oturumda güncellendi. Değişikliklerin kaybolmadı; sayfayı yenileyip son sürümle karşılaştırman gerekiyor.",
    };
  }
  if (input.saveKind === "error") {
    return {
      kind: "error",
      message: input.saveMessage ?? "Kaydetme başarısız.",
    };
  }
  if (input.saveKind === "saved") {
    return {
      kind: "saved",
      message: input.saveMessage ?? "Taslak kaydedildi.",
    };
  }
  if (input.isDirty) {
    return { kind: "dirty" };
  }
  return { kind: "clean" };
}

export function presentSaveStateLabel(state: SavePresentationState): string {
  switch (state.kind) {
    case "clean":
      return "Kaydedildi";
    case "dirty":
      return "Kaydedilmemiş değişiklikler";
    case "saving":
      return "Kaydediliyor";
    case "saved":
      return state.message;
    case "error":
      return state.message;
    case "conflict":
      return state.message;
  }
}
