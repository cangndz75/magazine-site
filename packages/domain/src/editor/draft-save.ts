import { WORKFLOW_STATUS, type WorkflowStatus } from "../workflow-status";
import { PUBLISHING_ERROR, type PublishingDecision } from "../publishing/errors";
import { assertVersionEditable } from "../publishing/invariants";
import { assertCanApproveVersion, assertCanRequestChanges, assertCanSubmitForReview } from "../publishing/transitions";
import { assertExpectedUpdatedAt } from "./concurrency";
import {
  authorizeEditorContentMutation,
  type EditorStaffScope,
} from "./scope";

export function decideSaveDraft(input: {
  requestedVersionId: string;
  draftVersionId: string | null;
  workflowStatus: WorkflowStatus;
  publishedVersionId: string | null;
  scheduledVersionId: string | null;
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
}): PublishingDecision<true> {
  if (input.requestedVersionId !== input.draftVersionId) {
    return { ok: false, code: PUBLISHING_ERROR.VERSION_NOT_CURRENT_DRAFT };
  }

  if (input.workflowStatus !== WORKFLOW_STATUS.DRAFT) {
    return { ok: false, code: PUBLISHING_ERROR.VERSION_NOT_EDITABLE };
  }

  const editable = assertVersionEditable({
    versionId: input.requestedVersionId,
    workflowStatus: input.workflowStatus,
    publishedVersionId: input.publishedVersionId,
    scheduledVersionId: input.scheduledVersionId,
  });
  if (!editable.ok) {
    return editable;
  }

  return assertExpectedUpdatedAt({
    currentUpdatedAt: input.currentUpdatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
}

export function decideLockedDraftSave(input: {
  requestedVersionId: string;
  draftVersionId: string | null;
  workflowStatus: WorkflowStatus;
  publishedVersionId: string | null;
  scheduledVersionId: string | null;
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
  scope: EditorStaffScope;
  currentPrimaryCategoryId: string | null;
  nextCategoryIds: readonly string[];
  nextPrimaryCategoryId: string | null;
}): PublishingDecision<true> {
  const editable = decideSaveDraft(input);
  if (!editable.ok) {
    return editable;
  }

  return authorizeEditorContentMutation({
    ...input.scope,
    currentPrimaryCategoryId: input.currentPrimaryCategoryId,
    nextCategoryIds: input.nextCategoryIds,
    nextPrimaryCategoryId: input.nextPrimaryCategoryId,
    requireSelectedPrimary: true,
  });
}

export function decideSubmitForReview(input: {
  contentItemId: string;
  versionContentItemId: string;
  draftVersionId: string | null;
  versionId: string;
  workflowStatus: WorkflowStatus;
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
}): PublishingDecision<true> {
  const allowed = assertCanSubmitForReview({
    contentItemId: input.contentItemId,
    versionContentItemId: input.versionContentItemId,
    draftVersionId: input.draftVersionId,
    versionId: input.versionId,
    workflowStatus: input.workflowStatus,
  });
  if (!allowed.ok) {
    return allowed;
  }

  return assertExpectedUpdatedAt({
    currentUpdatedAt: input.currentUpdatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
}

export function decideApproveForReview(input: {
  contentItemId: string;
  versionContentItemId: string;
  draftVersionId: string | null;
  versionId: string;
  workflowStatus: WorkflowStatus;
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
}): PublishingDecision<true> {
  const token = assertExpectedUpdatedAt({
    currentUpdatedAt: input.currentUpdatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (!token.ok) {
    return token;
  }

  return assertCanApproveVersion({
    contentItemId: input.contentItemId,
    versionContentItemId: input.versionContentItemId,
    draftVersionId: input.draftVersionId,
    versionId: input.versionId,
    workflowStatus: input.workflowStatus,
  });
}

export function decideRequestChanges(input: {
  contentItemId: string;
  versionContentItemId: string;
  draftVersionId: string | null;
  versionId: string;
  workflowStatus: WorkflowStatus;
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
}): PublishingDecision<true> {
  const token = assertExpectedUpdatedAt({
    currentUpdatedAt: input.currentUpdatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (!token.ok) {
    return token;
  }

  return assertCanRequestChanges({
    contentItemId: input.contentItemId,
    versionContentItemId: input.versionContentItemId,
    draftVersionId: input.draftVersionId,
    versionId: input.versionId,
    workflowStatus: input.workflowStatus,
  });
}
