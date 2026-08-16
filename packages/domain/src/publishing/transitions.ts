import { WORKFLOW_STATUS, type WorkflowStatus } from "../workflow-status";
import { PUBLISHING_ERROR, type PublishingDecision } from "./errors";

const ALLOWED_WORKFLOW_TRANSITIONS: Record<
  WorkflowStatus,
  readonly WorkflowStatus[]
> = {
  [WORKFLOW_STATUS.DRAFT]: [WORKFLOW_STATUS.IN_REVIEW],
  [WORKFLOW_STATUS.IN_REVIEW]: [
    WORKFLOW_STATUS.APPROVED,
    WORKFLOW_STATUS.DRAFT,
  ],
  [WORKFLOW_STATUS.APPROVED]: [],
};

export function isAllowedWorkflowTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
): boolean {
  return ALLOWED_WORKFLOW_TRANSITIONS[from].includes(to);
}

export function assertWorkflowTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
): PublishingDecision<true> {
  if (!isAllowedWorkflowTransition(from, to)) {
    return { ok: false, code: PUBLISHING_ERROR.INVALID_WORKFLOW_TRANSITION };
  }

  return { ok: true, value: true };
}

export function assertCurrentDraftVersion(
  draftVersionId: string | null,
  versionId: string,
): PublishingDecision<true> {
  if (draftVersionId !== versionId) {
    return { ok: false, code: PUBLISHING_ERROR.VERSION_NOT_CURRENT_DRAFT };
  }

  return { ok: true, value: true };
}

export function assertCanSubmitForReview(input: {
  contentItemId: string;
  versionContentItemId: string;
  draftVersionId: string | null;
  versionId: string;
  workflowStatus: WorkflowStatus;
}): PublishingDecision<true> {
  if (input.versionContentItemId !== input.contentItemId) {
    return { ok: false, code: PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM };
  }

  const currentDraft = assertCurrentDraftVersion(
    input.draftVersionId,
    input.versionId,
  );
  if (!currentDraft.ok) {
    return currentDraft;
  }

  return assertWorkflowTransition(input.workflowStatus, WORKFLOW_STATUS.IN_REVIEW);
}

export function assertCanApproveVersion(input: {
  contentItemId: string;
  versionContentItemId: string;
  draftVersionId: string | null;
  versionId: string;
  workflowStatus: WorkflowStatus;
}): PublishingDecision<true> {
  if (input.versionContentItemId !== input.contentItemId) {
    return { ok: false, code: PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM };
  }

  const currentDraft = assertCurrentDraftVersion(
    input.draftVersionId,
    input.versionId,
  );
  if (!currentDraft.ok) {
    return currentDraft;
  }

  return assertWorkflowTransition(input.workflowStatus, WORKFLOW_STATUS.APPROVED);
}

export function assertCanRequestChanges(input: {
  contentItemId: string;
  versionContentItemId: string;
  draftVersionId: string | null;
  versionId: string;
  workflowStatus: WorkflowStatus;
}): PublishingDecision<true> {
  if (input.versionContentItemId !== input.contentItemId) {
    return { ok: false, code: PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM };
  }

  const currentDraft = assertCurrentDraftVersion(
    input.draftVersionId,
    input.versionId,
  );
  if (!currentDraft.ok) {
    return currentDraft;
  }

  return assertWorkflowTransition(input.workflowStatus, WORKFLOW_STATUS.DRAFT);
}
