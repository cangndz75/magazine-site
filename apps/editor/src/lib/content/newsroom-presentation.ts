import {
  NEWSROOM_SORT,
  NEWSROOM_VIEW,
  READINESS_OVERALL_STATE,
  type ArticleReadinessSummaryDTO,
  type ListAttentionSummary,
  type NewsroomSort,
  type NewsroomView,
  type NewsroomViewCounts,
} from "@magazine/domain";

export const NEWSROOM_VIEW_LABELS: Record<NewsroomView, string> = {
  [NEWSROOM_VIEW.ALL]: "Tümü",
  [NEWSROOM_VIEW.ATTENTION]: "Dikkat",
  [NEWSROOM_VIEW.IN_REVIEW]: "İncelemede",
  [NEWSROOM_VIEW.SCHEDULED]: "Zamanlanmış",
  [NEWSROOM_VIEW.PUBLISHED]: "Yayında",
  [NEWSROOM_VIEW.DRAFTS]: "Taslaklar",
};

export const NEWSROOM_SORT_LABELS: Record<NewsroomSort, string> = {
  [NEWSROOM_SORT.UPDATED_DESC]: "Son güncelleme",
  [NEWSROOM_SORT.PUBLISHED_DESC]: "Yayın tarihi (yeni)",
  [NEWSROOM_SORT.PUBLISHED_ASC]: "Yayın tarihi (eski)",
  [NEWSROOM_SORT.SCHEDULE_ASC]: "Zamanlama",
};

export const NEWSROOM_SORT_OPTIONS = Object.entries(NEWSROOM_SORT_LABELS).map(
  ([value, label]) => ({ value: value as NewsroomSort, label }),
);

const ATTENTION_LABEL_OVERRIDES: Record<string, string> = {
  "Legal hold": "Hukuki bekletme",
};

export function presentAttentionLabel(
  attention: ListAttentionSummary,
): string | null {
  if (attention.severity === "none" || !attention.label) {
    return null;
  }

  return ATTENTION_LABEL_OVERRIDES[attention.label] ?? attention.label;
}

export function attentionBadgeVariant(
  severity: ListAttentionSummary["severity"],
): "neutral" | "warning" | "blocked" {
  if (severity === "blocked") {
    return "blocked";
  }
  if (severity === "warning") {
    return "warning";
  }
  return "neutral";
}

export function presentNewsroomReadinessSummary(
  readiness: ArticleReadinessSummaryDTO,
): string {
  if (readiness.overallState === READINESS_OVERALL_STATE.BLOCKED) {
    return readiness.topIssue ?? `${readiness.blockingCount} engel var`;
  }

  if (readiness.overallState === READINESS_OVERALL_STATE.NEEDS_ATTENTION) {
    return readiness.topIssue ?? `${readiness.warningCount} konu kontrol edilmeli`;
  }

  return "Sorun görünmüyor";
}

export function presentNewsroomReadinessState(
  readiness: ArticleReadinessSummaryDTO,
): string {
  switch (readiness.overallState) {
    case READINESS_OVERALL_STATE.BLOCKED:
      return "Engelli";
    case READINESS_OVERALL_STATE.NEEDS_ATTENTION:
      return "Kontrol edilmeli";
    default:
      return "Hazır";
  }
}

export type NewsroomEmptyState = {
  title: string;
  detail: string | null;
};

export function newsroomEmptyState(
  view: NewsroomView,
  hasFilters: boolean,
): NewsroomEmptyState {
  if (hasFilters) {
    return {
      title: "Bu filtrelere uygun haber bulunamadı.",
      detail: "Farklı filtreler deneyin veya filtreleri temizleyin.",
    };
  }

  switch (view) {
    case NEWSROOM_VIEW.ATTENTION:
      return {
        title: "Dikkat gerektiren haber yok.",
        detail: "Legal hold, yayın engeli veya inceleme notu bekleyen içerik görünmüyor.",
      };
    case NEWSROOM_VIEW.IN_REVIEW:
      return {
        title: "İncelemede haber yok.",
        detail: "Editöryal inceleme kuyruğu şu an boş.",
      };
    case NEWSROOM_VIEW.SCHEDULED:
      return {
        title: "Zamanlanmış haber yok.",
        detail: "Yayın takvimi için planlanmış içerik bulunmuyor.",
      };
    case NEWSROOM_VIEW.PUBLISHED:
      return {
        title: "Yayında haber yok.",
        detail: "Bu görünüm yalnızca yayındaki içerikleri listeler.",
      };
    case NEWSROOM_VIEW.DRAFTS:
      return {
        title: "Taslak haber yok.",
        detail: "Taslak durumundaki içerik bulunmuyor.",
      };
    default:
      return {
        title: "Henüz haber oluşturulmamış.",
        detail: "Yeni Haber ile taslak oluşturabilirsiniz.",
      };
  }
}

export function newsroomViewCount(
  view: NewsroomView,
  counts: NewsroomViewCounts,
): number {
  switch (view) {
    case NEWSROOM_VIEW.ATTENTION:
      return counts.attention;
    case NEWSROOM_VIEW.IN_REVIEW:
      return counts.inReview;
    case NEWSROOM_VIEW.SCHEDULED:
      return counts.scheduled;
    case NEWSROOM_VIEW.PUBLISHED:
      return counts.published;
    case NEWSROOM_VIEW.DRAFTS:
      return counts.drafts;
    default:
      return counts.all;
  }
}

export const NEWSROOM_VIEW_TABS: NewsroomView[] = [
  NEWSROOM_VIEW.ALL,
  NEWSROOM_VIEW.ATTENTION,
  NEWSROOM_VIEW.IN_REVIEW,
  NEWSROOM_VIEW.SCHEDULED,
  NEWSROOM_VIEW.PUBLISHED,
  NEWSROOM_VIEW.DRAFTS,
];
