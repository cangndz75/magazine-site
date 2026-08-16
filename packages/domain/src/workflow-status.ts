export const WORKFLOW_STATUS = {
  DRAFT: "DRAFT",
  IN_REVIEW: "IN_REVIEW",
  APPROVED: "APPROVED",
} as const;

export type WorkflowStatus =
  (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS];

export const WORKFLOW_STATUSES = [
  WORKFLOW_STATUS.DRAFT,
  WORKFLOW_STATUS.IN_REVIEW,
  WORKFLOW_STATUS.APPROVED,
] as const;
