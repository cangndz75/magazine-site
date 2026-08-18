import type { WorkflowStatus } from "@magazine/domain";

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  DRAFT: "Taslak",
  IN_REVIEW: "İncelemede",
  APPROVED: "Onaylandı",
};

export const PUBLICATION_STATUS_LABELS = {
  NEVER_PUBLISHED: "Hiç yayınlanmadı",
  PUBLISHED: "Yayında",
  UNPUBLISHED: "Yayından kaldırıldı",
} as const;

export const AUTHOR_ROLE_LABELS = {
  AUTHOR: "Yazar",
  CONTRIBUTOR: "Katkıda bulunan",
} as const;

export const REVIEW_EVENT_LABELS = {
  SUBMITTED: "İncelemeye gönderildi",
  APPROVED: "Onaylandı",
  CHANGES_REQUESTED: "Değişiklik istendi",
} as const;

export type RevisionHistoryItem = {
  id: string;
  versionNumber: number;
  workflowStatus: WorkflowStatus;
  title: string;
  createdAt: string;
  isCurrentDraft: boolean;
  isScheduledVersion: boolean;
  isPublishedVersion: boolean;
};

export function formatRevisionLabel(versionNumber: number): string {
  return `Sürüm ${versionNumber}`;
}

export function revisionPointerLabels(item: RevisionHistoryItem): string[] {
  const labels: string[] = [];
  if (item.isPublishedVersion) {
    labels.push("Yayındaki");
  }
  if (item.isCurrentDraft) {
    labels.push("Güncel taslak");
  }
  if (item.isScheduledVersion) {
    labels.push("Zamanlanmış");
  }
  return labels;
}
