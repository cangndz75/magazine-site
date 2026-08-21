export type ScheduledPublishJob = {
  contentItemId: string;
  scheduleGeneration: number;
};

export function isStaleScheduleGeneration(
  jobGeneration: number,
  currentGeneration: number,
): boolean {
  return jobGeneration !== currentGeneration;
}

export function shouldExecuteScheduledPublish(
  job: Pick<ScheduledPublishJob, "scheduleGeneration">,
  currentGeneration: number,
): boolean {
  return !isStaleScheduleGeneration(
    job.scheduleGeneration,
    currentGeneration,
  );
}

export const SCHEDULED_PUBLISH_DECISION = {
  NOOP_STALE: "NOOP_STALE",
  NOOP_NOT_SCHEDULED: "NOOP_NOT_SCHEDULED",
  NOOP_NOT_DUE: "NOOP_NOT_DUE",
  NOOP_LEGAL_HOLD: "NOOP_LEGAL_HOLD",
  EXECUTE: "EXECUTE",
} as const;

export type ScheduledPublishDecisionCode =
  (typeof SCHEDULED_PUBLISH_DECISION)[keyof typeof SCHEDULED_PUBLISH_DECISION];

export type ScheduledPublishExecutionInput = {
  jobGeneration: number;
  currentGeneration: number;
  scheduledVersionId: string | null;
  scheduledAt: Date | string | null;
  now: Date;
  legalHoldAt?: Date | string | null;
  retractedAt?: Date | string | null;
  takedownAt?: Date | string | null;
};

export type ScheduledPublishExecutionDecision =
  | { decision: typeof SCHEDULED_PUBLISH_DECISION.NOOP_STALE }
  | { decision: typeof SCHEDULED_PUBLISH_DECISION.NOOP_NOT_SCHEDULED }
  | { decision: typeof SCHEDULED_PUBLISH_DECISION.NOOP_NOT_DUE }
  | { decision: typeof SCHEDULED_PUBLISH_DECISION.NOOP_LEGAL_HOLD }
  | {
      decision: typeof SCHEDULED_PUBLISH_DECISION.EXECUTE;
      versionId: string;
    };

export function decideScheduledPublishExecution(
  input: ScheduledPublishExecutionInput,
): ScheduledPublishExecutionDecision {
  if (input.legalHoldAt != null || input.retractedAt != null || input.takedownAt != null) {
    return { decision: SCHEDULED_PUBLISH_DECISION.NOOP_LEGAL_HOLD };
  }

  if (isStaleScheduleGeneration(input.jobGeneration, input.currentGeneration)) {
    return { decision: SCHEDULED_PUBLISH_DECISION.NOOP_STALE };
  }

  if (input.scheduledVersionId === null || input.scheduledAt === null) {
    return { decision: SCHEDULED_PUBLISH_DECISION.NOOP_NOT_SCHEDULED };
  }

  const scheduledAtMs =
    input.scheduledAt instanceof Date
      ? input.scheduledAt.getTime()
      : new Date(input.scheduledAt).getTime();

  if (scheduledAtMs > input.now.getTime()) {
    return { decision: SCHEDULED_PUBLISH_DECISION.NOOP_NOT_DUE };
  }

  return {
    decision: SCHEDULED_PUBLISH_DECISION.EXECUTE,
    versionId: input.scheduledVersionId,
  };
}
