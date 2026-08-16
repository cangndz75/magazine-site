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
