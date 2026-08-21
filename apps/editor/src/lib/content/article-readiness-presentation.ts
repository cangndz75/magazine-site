import {
  READINESS_OVERALL_STATE,
  READINESS_SECTION,
  READINESS_SECTION_STATE,
  type ArticleReadinessDTO,
  type ReadinessSectionId,
  type ReadinessSectionState,
} from "@magazine/domain";

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
