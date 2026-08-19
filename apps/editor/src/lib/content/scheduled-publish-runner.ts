import {
  SCHEDULED_PUBLISH_DECISION,
  isBearerMachineAuthorized,
  isUuid,
  type ScheduledPublishDecisionCode,
} from "@magazine/domain";
import {
  executeScheduledPublish,
  type ScheduledPublishExecutionResult,
} from "@magazine/db/publishing";

export const SCHEDULED_PUBLISH_RUNNER_ERROR = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_REQUEST: "INVALID_REQUEST",
} as const;

export class ScheduledPublishRunnerError extends Error {
  readonly code: (typeof SCHEDULED_PUBLISH_RUNNER_ERROR)[keyof typeof SCHEDULED_PUBLISH_RUNNER_ERROR];
  readonly status: 400 | 401;

  constructor(
    code: (typeof SCHEDULED_PUBLISH_RUNNER_ERROR)[keyof typeof SCHEDULED_PUBLISH_RUNNER_ERROR],
    status: 400 | 401,
  ) {
    super(code);
    this.name = "ScheduledPublishRunnerError";
    this.code = code;
    this.status = status;
  }
}

export type ScheduledPublishJobPayload = {
  contentItemId: string;
  scheduleGeneration: number;
};

export type ScheduledPublishRunnerResult =
  | {
      outcome: Exclude<
        ScheduledPublishDecisionCode,
        typeof SCHEDULED_PUBLISH_DECISION.EXECUTE
      >;
    }
  | {
      outcome: typeof SCHEDULED_PUBLISH_DECISION.EXECUTE;
      contentItemId: string;
      slug: string;
      publishedVersionId: string;
    };

export type ScheduledPublishRunnerDeps = {
  execute?: (
    contentItemId: string,
    scheduleGeneration: number,
  ) => Promise<ScheduledPublishExecutionResult>;
};

export function assertScheduledPublishRunnerAuthorized(
  request: Pick<Request, "headers">,
  expectedSecret: string,
): void {
  if (
    !isBearerMachineAuthorized(
      request.headers.get("authorization"),
      expectedSecret,
    )
  ) {
    throw new ScheduledPublishRunnerError(
      SCHEDULED_PUBLISH_RUNNER_ERROR.UNAUTHORIZED,
      401,
    );
  }
}

export function parseScheduledPublishJobPayload(
  body: unknown,
): ScheduledPublishJobPayload {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw invalidRequest();
  }

  const record = body as Record<string, unknown>;
  if (
    typeof record.contentItemId !== "string" ||
    !isUuid(record.contentItemId) ||
    typeof record.scheduleGeneration !== "number" ||
    !Number.isInteger(record.scheduleGeneration) ||
    record.scheduleGeneration < 0
  ) {
    throw invalidRequest();
  }

  return {
    contentItemId: record.contentItemId,
    scheduleGeneration: record.scheduleGeneration,
  };
}

export async function runScheduledPublishJob(
  payload: ScheduledPublishJobPayload,
  deps: ScheduledPublishRunnerDeps = {},
): Promise<ScheduledPublishRunnerResult> {
  const execute = deps.execute ?? executeScheduledPublish;
  const result = await execute(payload.contentItemId, payload.scheduleGeneration);

  if (result.outcome !== SCHEDULED_PUBLISH_DECISION.EXECUTE) {
    return {
      outcome: result.outcome,
    };
  }

  return {
    outcome: result.outcome,
    contentItemId: result.publish.contentItemId,
    slug: result.publish.slug,
    publishedVersionId: result.publish.publishedVersionId,
  };
}

function invalidRequest(): ScheduledPublishRunnerError {
  return new ScheduledPublishRunnerError(
    SCHEDULED_PUBLISH_RUNNER_ERROR.INVALID_REQUEST,
    400,
  );
}
