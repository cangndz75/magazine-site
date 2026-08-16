import type { PublicationStatus, WorkflowStatus } from "@magazine/domain";

export type ContentStatusInfo = {
  publicationLabel: string;
  publicationVariant: "neutral" | "success" | "warning";
  workflowLabel: string;
  workflowVariant: "neutral" | "info" | "success";
  scheduledLabel: string | null;
  hasNewerDraft: boolean;
};

export type ContentStatusInput = {
  publicationStatus: PublicationStatus;
  workflowStatus: WorkflowStatus;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: Date | string | null;
  displayVersionId: string;
};

const PUBLICATION_LABELS: Record<PublicationStatus, string> = {
  NEVER_PUBLISHED: "Yayınlanmamış",
  PUBLISHED: "Yayında",
  UNPUBLISHED: "Kaldırıldı",
};

const PUBLICATION_VARIANTS: Record<
  PublicationStatus,
  "neutral" | "success" | "warning"
> = {
  NEVER_PUBLISHED: "neutral",
  PUBLISHED: "success",
  UNPUBLISHED: "warning",
};

const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  DRAFT: "Taslak",
  IN_REVIEW: "İncelemede",
  APPROVED: "Onaylandı",
};

const WORKFLOW_VARIANTS: Record<WorkflowStatus, "neutral" | "info" | "success"> = {
  DRAFT: "neutral",
  IN_REVIEW: "info",
  APPROVED: "success",
};

export function deriveContentStatus(input: ContentStatusInput): ContentStatusInfo {
  const hasNewerDraft =
    input.publicationStatus === "PUBLISHED" &&
    input.draftVersionId !== null &&
    input.draftVersionId !== input.publishedVersionId;

  let scheduledLabel: string | null = null;
  if (input.scheduledVersionId && input.scheduledAt) {
    scheduledLabel = "Zamanlanmış";
  }

  return {
    publicationLabel: PUBLICATION_LABELS[input.publicationStatus],
    publicationVariant: PUBLICATION_VARIANTS[input.publicationStatus],
    workflowLabel: WORKFLOW_LABELS[input.workflowStatus],
    workflowVariant: WORKFLOW_VARIANTS[input.workflowStatus],
    scheduledLabel,
    hasNewerDraft,
  };
}
