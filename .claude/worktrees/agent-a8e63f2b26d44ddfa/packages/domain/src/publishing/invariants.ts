import { type CategoryAssignment, assertPublishablePrimaryCategory } from "../primary-category";
import { PUBLICATION_STATUS, type PublicationStatus } from "../publication-status";
import { WORKFLOW_STATUS, type WorkflowStatus } from "../workflow-status";
import { hasPublicLegalWithdrawal, isContentLegalHoldActive } from "../legal-action";
import { PUBLISHING_ERROR, type PublishingDecision } from "./errors";

export type ContentLifecycleItem = {
  id: string;
  deletedAt: Date | string | null;
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: Date | string | null;
  scheduleGeneration: number;
  publishedAt: Date | string | null;
  publicDateModified: Date | string | null;
  legalHoldAt?: Date | string | null;
  retractedAt?: Date | string | null;
  takedownAt?: Date | string | null;
};

export type ContentLifecycleVersion = {
  id: string;
  contentItemId: string;
  workflowStatus: WorkflowStatus;
  isMaterialUpdate: boolean;
};

export function assertContentNotDeleted(
  deletedAt: Date | string | null,
): PublishingDecision<true> {
  if (deletedAt !== null) {
    return { ok: false, code: PUBLISHING_ERROR.CONTENT_DELETED };
  }

  return { ok: true, value: true };
}

export function assertContentNotOnLegalHold(
  legalHoldAt: Date | string | null | undefined,
): PublishingDecision<true> {
  if (isContentLegalHoldActive(legalHoldAt)) {
    return { ok: false, code: PUBLISHING_ERROR.CONTENT_LEGAL_HOLD };
  }

  return { ok: true, value: true };
}

export function assertContentNotLegallyWithdrawn(state: {
  retractedAt?: Date | string | null;
  takedownAt?: Date | string | null;
}): PublishingDecision<true> {
  if (hasPublicLegalWithdrawal(state)) {
    return { ok: false, code: PUBLISHING_ERROR.CONTENT_LEGALLY_WITHDRAWN };
  }

  return { ok: true, value: true };
}

export function assertEditorialMutationAllowed(item: {
  deletedAt: Date | string | null;
  legalHoldAt?: Date | string | null;
}): PublishingDecision<true> {
  const notDeleted = assertContentNotDeleted(item.deletedAt);
  if (!notDeleted.ok) {
    return notDeleted;
  }

  return assertContentNotOnLegalHold(item.legalHoldAt);
}

export function assertVersionOwnedByItem(
  contentItemId: string,
  versionContentItemId: string,
): PublishingDecision<true> {
  if (contentItemId !== versionContentItemId) {
    return { ok: false, code: PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM };
  }

  return { ok: true, value: true };
}

export function assertVersionEditable(input: {
  versionId: string;
  workflowStatus: WorkflowStatus;
  publishedVersionId: string | null;
  scheduledVersionId: string | null;
}): PublishingDecision<true> {
  if (input.workflowStatus !== WORKFLOW_STATUS.DRAFT) {
    return { ok: false, code: PUBLISHING_ERROR.VERSION_NOT_EDITABLE };
  }

  if (
    input.versionId === input.publishedVersionId ||
    input.versionId === input.scheduledVersionId
  ) {
    return { ok: false, code: PUBLISHING_ERROR.VERSION_NOT_EDITABLE };
  }

  return { ok: true, value: true };
}

export function nextScheduleGeneration(current: number): number {
  return current + 1;
}

export function nextVersionNumber(maxVersionNumber: number): number {
  return maxVersionNumber + 1;
}

export function resolveDraftRevisionSource(input: {
  sourceVersionId?: string | null;
  draftVersionId: string | null;
  publishedVersionId: string | null;
}): PublishingDecision<string> {
  if (input.draftVersionId !== null) {
    return { ok: false, code: PUBLISHING_ERROR.DRAFT_ALREADY_EXISTS };
  }

  if (input.sourceVersionId) {
    return { ok: true, value: input.sourceVersionId };
  }

  if (input.publishedVersionId) {
    return { ok: true, value: input.publishedVersionId };
  }

  // NEVER_PUBLISHED + only a scheduled version is not an implicit clone source.
  return { ok: false, code: PUBLISHING_ERROR.NO_REVISION_SOURCE };
}

export function assertAllowedPublishTarget(input: {
  versionId: string;
  publicationStatus: PublicationStatus;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  publishedVersionId: string | null;
}): PublishingDecision<true> {
  if (input.versionId === input.draftVersionId) {
    return { ok: true, value: true };
  }

  if (input.versionId === input.scheduledVersionId) {
    return { ok: true, value: true };
  }

  if (
    input.publicationStatus === PUBLICATION_STATUS.UNPUBLISHED &&
    input.versionId === input.publishedVersionId
  ) {
    return { ok: true, value: true };
  }

  return { ok: false, code: PUBLISHING_ERROR.INVALID_PUBLISH_TARGET };
}

export function assertPublishReady(input: {
  workflowStatus: WorkflowStatus;
  categories: readonly CategoryAssignment[];
}): PublishingDecision<true> {
  if (input.workflowStatus !== WORKFLOW_STATUS.APPROVED) {
    return { ok: false, code: PUBLISHING_ERROR.VERSION_NOT_APPROVED };
  }

  const primary = assertPublishablePrimaryCategory(input.categories);
  if (!primary.ok) {
    return { ok: false, code: PUBLISHING_ERROR.PUBLISH_READINESS_FAILED };
  }

  return { ok: true, value: true };
}

function toTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export type PublishPlan = {
  publicationStatus: typeof PUBLICATION_STATUS.PUBLISHED;
  publishedVersionId: string;
  publishedAt: Date;
  publicDateModified: Date;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAt: Date | string | null;
  scheduleGeneration: number;
};

export function decidePublish(input: {
  item: ContentLifecycleItem;
  version: ContentLifecycleVersion;
  categories: readonly CategoryAssignment[];
  now: Date;
}): PublishingDecision<PublishPlan> {
  const allowed = assertEditorialMutationAllowed(input.item);
  if (!allowed.ok) {
    return allowed;
  }

  const withdrawn = assertContentNotLegallyWithdrawn(input.item);
  if (!withdrawn.ok) {
    return withdrawn;
  }

  const owned = assertVersionOwnedByItem(input.item.id, input.version.contentItemId);
  if (!owned.ok) {
    return owned;
  }

  const target = assertAllowedPublishTarget({
    versionId: input.version.id,
    publicationStatus: input.item.publicationStatus,
    draftVersionId: input.item.draftVersionId,
    scheduledVersionId: input.item.scheduledVersionId,
    publishedVersionId: input.item.publishedVersionId,
  });
  if (!target.ok) {
    return target;
  }

  const ready = assertPublishReady({
    workflowStatus: input.version.workflowStatus,
    categories: input.categories,
  });
  if (!ready.ok) {
    return ready;
  }

  const isFirstPublication = input.item.publishedAt === null;
  const publishedAt = isFirstPublication
    ? input.now
    : new Date(toTime(input.item.publishedAt as Date | string));

  let publicDateModified: Date;
  if (isFirstPublication) {
    publicDateModified = input.now;
  } else if (input.version.isMaterialUpdate) {
    publicDateModified = input.now;
  } else if (input.item.publicDateModified) {
    publicDateModified = new Date(toTime(input.item.publicDateModified));
  } else {
    publicDateModified = input.now;
  }

  const draftVersionId =
    input.item.draftVersionId === input.version.id ? null : input.item.draftVersionId;

  let scheduledVersionId = input.item.scheduledVersionId;
  let scheduledAt = input.item.scheduledAt;
  let scheduleGeneration = input.item.scheduleGeneration;

  if (scheduledVersionId === input.version.id) {
    scheduledVersionId = null;
    scheduledAt = null;
    scheduleGeneration = nextScheduleGeneration(scheduleGeneration);
  }

  return {
    ok: true,
    value: {
      publicationStatus: PUBLICATION_STATUS.PUBLISHED,
      publishedVersionId: input.version.id,
      publishedAt,
      publicDateModified,
      draftVersionId,
      scheduledVersionId,
      scheduledAt,
      scheduleGeneration,
    },
  };
}

export type UnpublishPlan = {
  publicationStatus: typeof PUBLICATION_STATUS.UNPUBLISHED;
};

export function decideUnpublish(
  item: ContentLifecycleItem,
): PublishingDecision<UnpublishPlan> {
  const allowed = assertEditorialMutationAllowed(item);
  if (!allowed.ok) {
    return allowed;
  }

  if (item.publicationStatus !== PUBLICATION_STATUS.PUBLISHED) {
    return { ok: false, code: PUBLISHING_ERROR.NOT_PUBLISHED };
  }

  return {
    ok: true,
    value: { publicationStatus: PUBLICATION_STATUS.UNPUBLISHED },
  };
}

export type SchedulePlan = {
  scheduledVersionId: string;
  scheduledAt: Date;
  scheduleGeneration: number;
  draftVersionId: string | null;
};

export function decideSchedule(input: {
  item: ContentLifecycleItem;
  version: ContentLifecycleVersion;
  categories: readonly CategoryAssignment[];
  scheduledAt: Date;
  now: Date;
}): PublishingDecision<SchedulePlan> {
  const allowed = assertEditorialMutationAllowed(input.item);
  if (!allowed.ok) {
    return allowed;
  }

  const owned = assertVersionOwnedByItem(input.item.id, input.version.contentItemId);
  if (!owned.ok) {
    return owned;
  }

  const ready = assertPublishReady({
    workflowStatus: input.version.workflowStatus,
    categories: input.categories,
  });
  if (!ready.ok) {
    return ready;
  }

  if (input.version.id === input.item.publishedVersionId) {
    return {
      ok: false,
      code: PUBLISHING_ERROR.CANNOT_SCHEDULE_PUBLISHED_VERSION,
    };
  }

  if (input.scheduledAt.getTime() <= input.now.getTime()) {
    return { ok: false, code: PUBLISHING_ERROR.SCHEDULE_NOT_IN_FUTURE };
  }

  if (input.item.scheduledVersionId !== null) {
    return { ok: false, code: PUBLISHING_ERROR.ALREADY_SCHEDULED };
  }

  const draftVersionId =
    input.item.draftVersionId === input.version.id
      ? null
      : input.item.draftVersionId;

  return {
    ok: true,
    value: {
      scheduledVersionId: input.version.id,
      scheduledAt: input.scheduledAt,
      scheduleGeneration: nextScheduleGeneration(input.item.scheduleGeneration),
      draftVersionId,
    },
  };
}

export function decideReschedule(input: {
  item: ContentLifecycleItem;
  scheduledAt: Date;
  now: Date;
}): PublishingDecision<SchedulePlan> {
  const allowed = assertEditorialMutationAllowed(input.item);
  if (!allowed.ok) {
    return allowed;
  }

  if (input.item.scheduledVersionId === null || input.item.scheduledAt === null) {
    return { ok: false, code: PUBLISHING_ERROR.NO_SCHEDULE };
  }

  if (input.scheduledAt.getTime() <= input.now.getTime()) {
    return { ok: false, code: PUBLISHING_ERROR.SCHEDULE_NOT_IN_FUTURE };
  }

  return {
    ok: true,
    value: {
      scheduledVersionId: input.item.scheduledVersionId,
      scheduledAt: input.scheduledAt,
      scheduleGeneration: nextScheduleGeneration(input.item.scheduleGeneration),
      draftVersionId: input.item.draftVersionId,
    },
  };
}

export type UnschedulePlan = {
  scheduledVersionId: null;
  scheduledAt: null;
  scheduleGeneration: number;
  draftVersionId: string | null;
};

export function decideUnschedule(
  item: ContentLifecycleItem,
): PublishingDecision<UnschedulePlan> {
  const allowed = assertEditorialMutationAllowed(item);
  if (!allowed.ok) {
    return allowed;
  }

  if (item.scheduledVersionId === null || item.scheduledAt === null) {
    return { ok: false, code: PUBLISHING_ERROR.NO_SCHEDULE };
  }

  // Restore the unscheduled version as the active draft pointer when none exists.
  // Keep a separate live draft untouched. Do not change workflowStatus: a
  // scheduled version is APPROVED and remains APPROVED, matching pre-schedule
  // approve → schedule behavior.
  return {
    ok: true,
    value: {
      scheduledVersionId: null,
      scheduledAt: null,
      scheduleGeneration: nextScheduleGeneration(item.scheduleGeneration),
      draftVersionId: item.draftVersionId ?? item.scheduledVersionId,
    },
  };
}
