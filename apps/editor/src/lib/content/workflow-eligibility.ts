import {
  assertAllowedPublishTarget,
  assertCanApproveVersion,
  assertCanRequestChanges,
  assertCanSubmitForReview,
  assertPublishReady,
  decideUnpublish,
  isContentLegalHoldActive,
  resolveDraftRevisionSource,
  type PublicationStatus,
  type WorkflowStatus,
} from "@magazine/domain";
import { LEGAL_HOLD_BLOCKED_COPY } from "@/lib/legal/presentation";
import {
  PUBLICATION_STATUS_LABELS,
  WORKFLOW_STATUS_LABELS,
} from "./revision-presentation";
import { formatEditorialDateTime } from "./editorial-timezone";

export type WorkflowActionId =
  | "submit-review"
  | "approve"
  | "request-changes"
  | "publish"
  | "schedule"
  | "reschedule"
  | "unschedule"
  | "create-revision"
  | "unpublish";

export type WorkflowActionPermissions = {
  canEdit: boolean;
  canReview: boolean;
  canPublish: boolean;
};

export type WorkflowEligibilityInput = {
  contentItemId: string;
  publicationStatus: PublicationStatus;
  workflowStatus: WorkflowStatus | null;
  focusedVersionId: string | null;
  focusedVersionNumber: number | null;
  draftVersionId: string | null;
  publishedVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: string | null;
  publishedVersionNumber: number | null;
  draftVersionNumber: number | null;
  scheduledVersionNumber: number | null;
  categories: readonly { isPrimary: boolean }[];
  permissions: WorkflowActionPermissions;
  isDirty: boolean;
  hasConcurrencyToken: boolean;
  legalHoldAt: string | null;
  retractedAt: string | null;
  takedownAt: string | null;
};

export type PresentedWorkflowAction = {
  id: WorkflowActionId;
  label: string;
};

export const UNPUBLISH_ACTION_LABEL = "Yayından kaldır";
export const UNPUBLISH_EFFECT_COPY =
  "Haber artık sitede yayınlanmayacak. İçerik, sürümler ve geçmiş korunacak.";

export type PresentedWorkflow = {
  publicationLabel: string;
  workflowLabel: string;
  focusedVersionLabel: string;
  publishedVersionLabel: string;
  draftVersionLabel: string;
  scheduledLabel: string | null;
  primary: PresentedWorkflowAction | null;
  secondary: PresentedWorkflowAction[];
  unpublish: PresentedWorkflowAction | null;
  unpublishCopy: string | null;
  unpublishScheduleWarning: string | null;
  scheduledRepublishNotice: string | null;
  unavailableReason: string | null;
  needsReviewNote: boolean;
  needsScheduleInput: boolean;
  confirmPublish: boolean;
  showReturnToQueue: boolean;
  createRevisionCopy: string | null;
  legalHoldNotice: string | null;
};

export function presentWorkflow(input: WorkflowEligibilityInput): PresentedWorkflow {
  const submit = canSubmitForReview(input);
  const approve = canApproveReview(input);
  const requestChanges = canRequestChangesAction(input);
  const publish = canPublishVersion(input);
  const schedule = canScheduleVersion(input);
  const reschedule = canReschedule(input);
  const unschedule = canUnschedule(input);
  const createRevision = canCreateDraftRevision(input);

  const unpublish = canUnpublish(input);
  const legalHoldActive = isContentLegalHoldActive(input.legalHoldAt);

  const available: PresentedWorkflowAction[] = [];
  if (submit) {
    available.push({ id: "submit-review", label: "İncelemeye gönder" });
  }
  if (approve) {
    available.push({ id: "approve", label: "Onayla" });
  }
  if (requestChanges) {
    available.push({ id: "request-changes", label: "Değişiklik iste" });
  }
  if (publish) {
    available.push({
      id: "publish",
      label:
        input.publicationStatus === "UNPUBLISHED" ? "Yeniden yayınla" : "Yayınla",
    });
  }
  if (schedule) {
    available.push({ id: "schedule", label: "Zamanla" });
  }
  if (reschedule) {
    available.push({ id: "reschedule", label: "Yeniden zamanla" });
  }
  if (unschedule) {
    available.push({ id: "unschedule", label: "Zamanlamayı iptal et" });
  }
  if (createRevision) {
    available.push({ id: "create-revision", label: "Yeni taslak oluştur" });
  }

  const [primary, ...secondary] = available;
  const scheduledAtLabel = input.scheduledAt
    ? formatEditorialDateTime(input.scheduledAt)
    : null;

  return {
    publicationLabel: PUBLICATION_STATUS_LABELS[input.publicationStatus],
    workflowLabel: input.workflowStatus
      ? WORKFLOW_STATUS_LABELS[input.workflowStatus]
      : "—",
    focusedVersionLabel: input.focusedVersionNumber
      ? `Sürüm ${input.focusedVersionNumber}`
      : "Yok",
    publishedVersionLabel: input.publishedVersionNumber
      ? `Sürüm ${input.publishedVersionNumber}`
      : "Yok",
    draftVersionLabel: input.draftVersionNumber
      ? `Sürüm ${input.draftVersionNumber}`
      : "Yok",
    scheduledLabel: scheduledAtLabel,
    primary: primary ?? null,
    secondary,
    unpublish: unpublish
      ? { id: "unpublish", label: UNPUBLISH_ACTION_LABEL }
      : null,
    unpublishCopy: unpublish ? UNPUBLISH_EFFECT_COPY : null,
    unpublishScheduleWarning:
      unpublish && input.scheduledVersionId && scheduledAtLabel
        ? `Zamanlanmış yayın duruyor: ${scheduledAtLabel}. Bu işlem zamanlamayı iptal etmez.`
        : null,
    scheduledRepublishNotice:
      input.publicationStatus === "UNPUBLISHED" &&
      input.scheduledVersionId &&
      scheduledAtLabel
        ? `Şu anda yayında değil. ${scheduledAtLabel} tarihinde yeniden yayınlanacak.`
        : null,
    unavailableReason: primary ? null : unavailableReason(input),
    needsReviewNote: requestChanges,
    needsScheduleInput: schedule || reschedule,
    confirmPublish: publish,
    showReturnToQueue: Boolean(approve || requestChanges),
    createRevisionCopy:
      createRevision &&
      input.draftVersionId === null &&
      input.publicationStatus === "UNPUBLISHED"
        ? "Bu içerik yayından kaldırıldı. Düzenlemek için yeni bir taslak oluşturun. Kayıtlı son yayın sürümü değişmez."
        : createRevision &&
            input.draftVersionId === null &&
            input.publicationStatus === "PUBLISHED"
          ? "Bu içerik yayında. Yeni değişiklik yapmak için yeni bir taslak oluşturun. Yayındaki sürüm değişmez."
          : null,
    legalHoldNotice: legalHoldActive ? LEGAL_HOLD_BLOCKED_COPY : null,
  };
}

export function canSubmitForReview(input: WorkflowEligibilityInput): boolean {
  if (
    !input.permissions.canEdit ||
    input.isDirty ||
    !input.hasConcurrencyToken ||
    !input.focusedVersionId ||
    !input.workflowStatus ||
    isContentLegalHoldActive(input.legalHoldAt)
  ) {
    return false;
  }

  return assertCanSubmitForReview({
    contentItemId: input.contentItemId,
    versionContentItemId: input.contentItemId,
    draftVersionId: input.draftVersionId,
    versionId: input.focusedVersionId,
    workflowStatus: input.workflowStatus,
  }).ok;
}

export function canApproveReview(input: WorkflowEligibilityInput): boolean {
  if (
    !input.permissions.canReview ||
    !input.hasConcurrencyToken ||
    !input.focusedVersionId ||
    !input.workflowStatus
  ) {
    return false;
  }

  return assertCanApproveVersion({
    contentItemId: input.contentItemId,
    versionContentItemId: input.contentItemId,
    draftVersionId: input.draftVersionId,
    versionId: input.focusedVersionId,
    workflowStatus: input.workflowStatus,
  }).ok;
}

export function canRequestChangesAction(input: WorkflowEligibilityInput): boolean {
  if (
    !input.permissions.canReview ||
    !input.hasConcurrencyToken ||
    !input.focusedVersionId ||
    !input.workflowStatus
  ) {
    return false;
  }

  return assertCanRequestChanges({
    contentItemId: input.contentItemId,
    versionContentItemId: input.contentItemId,
    draftVersionId: input.draftVersionId,
    versionId: input.focusedVersionId,
    workflowStatus: input.workflowStatus,
  }).ok;
}

export function canPublishVersion(input: WorkflowEligibilityInput): boolean {
  if (
    !input.permissions.canPublish ||
    !input.focusedVersionId ||
    !input.workflowStatus ||
    isContentLegalHoldActive(input.legalHoldAt)
  ) {
    return false;
  }

  const target = assertAllowedPublishTarget({
    versionId: input.focusedVersionId,
    publicationStatus: input.publicationStatus,
    draftVersionId: input.draftVersionId,
    scheduledVersionId: input.scheduledVersionId,
    publishedVersionId: input.publishedVersionId,
  });
  if (!target.ok) {
    return false;
  }

  return assertPublishReady({
    workflowStatus: input.workflowStatus,
    categories: input.categories,
  }).ok;
}

export function canScheduleVersion(input: WorkflowEligibilityInput): boolean {
  if (
    !input.permissions.canPublish ||
    !input.focusedVersionId ||
    !input.workflowStatus ||
    input.scheduledVersionId !== null ||
    input.focusedVersionId === input.publishedVersionId ||
    isContentLegalHoldActive(input.legalHoldAt)
  ) {
    return false;
  }

  return assertPublishReady({
    workflowStatus: input.workflowStatus,
    categories: input.categories,
  }).ok;
}

export function canReschedule(input: WorkflowEligibilityInput): boolean {
  return (
    input.permissions.canPublish &&
    input.scheduledVersionId !== null &&
    input.scheduledAt !== null
  );
}

export function canUnschedule(input: WorkflowEligibilityInput): boolean {
  return canReschedule(input);
}

export function canUnpublish(input: WorkflowEligibilityInput): boolean {
  if (!input.permissions.canPublish || isContentLegalHoldActive(input.legalHoldAt)) {
    return false;
  }

  return decideUnpublish({
    id: input.contentItemId,
    deletedAt: null,
    publicationStatus: input.publicationStatus,
    publishedVersionId: input.publishedVersionId,
    draftVersionId: input.draftVersionId,
    scheduledVersionId: input.scheduledVersionId,
    scheduledAt: input.scheduledAt,
    scheduleGeneration: 0,
    publishedAt: null,
    publicDateModified: null,
  }).ok;
}

export function revisionRequestSource(
  input: Pick<WorkflowEligibilityInput, "publishedVersionId" | "scheduledVersionId">,
): string | undefined {
  if (input.publishedVersionId) {
    return undefined;
  }
  return input.scheduledVersionId ?? undefined;
}

export function canCreateDraftRevision(input: WorkflowEligibilityInput): boolean {
  if (!input.permissions.canEdit || isContentLegalHoldActive(input.legalHoldAt)) {
    return false;
  }

  return resolveDraftRevisionSource({
    sourceVersionId: revisionRequestSource(input),
    draftVersionId: input.draftVersionId,
    publishedVersionId: input.publishedVersionId,
  }).ok;
}

function unavailableReason(input: WorkflowEligibilityInput): string | null {
  if (isContentLegalHoldActive(input.legalHoldAt)) {
    return LEGAL_HOLD_BLOCKED_COPY;
  }

  if (!input.focusedVersionId || !input.workflowStatus) {
    if (
      input.draftVersionId === null &&
      (input.publishedVersionId || input.scheduledVersionId) &&
      !input.permissions.canEdit
    ) {
      return "Yeni taslak oluşturma yetkin yok.";
    }
    return "Bu içerik için işlem yapılacak bir sürüm yok.";
  }

  if (
    input.draftVersionId === null &&
    input.publicationStatus === "PUBLISHED" &&
    !input.permissions.canEdit
  ) {
    return "Bu içerik yayında. Yeni taslak oluşturma yetkin yok.";
  }

  if (input.isDirty && input.workflowStatus === "DRAFT") {
    return "Kaydedilmemiş değişiklikler var. İncelemeye göndermeden önce kaydet.";
  }

  if (
    input.workflowStatus === "DRAFT" &&
    input.focusedVersionId !== input.draftVersionId
  ) {
    return "Yalnızca güncel taslak incelemeye gönderilebilir.";
  }

  if (input.workflowStatus === "DRAFT" && !input.permissions.canEdit) {
    return "Bu taslağı incelemeye gönderme yetkin yok.";
  }

  if (input.workflowStatus === "IN_REVIEW" && !input.permissions.canReview) {
    return "Bu sürüm inceleme bekliyor.";
  }

  if (input.workflowStatus === "APPROVED" && !input.permissions.canPublish) {
    return "Bu sürüm onaylandı. Yayınlama yetkin yok.";
  }

  if (input.workflowStatus === "APPROVED" && input.categories.every((item) => !item.isPrimary)) {
    return "Yayınlamak için bir ana kategori gerekir.";
  }

  if (input.workflowStatus === "IN_REVIEW") {
    return "Bu sürüm inceleme bekliyor.";
  }

  if (input.workflowStatus === "APPROVED") {
    return "Bu sürüm onaylandı.";
  }

  return null;
}
