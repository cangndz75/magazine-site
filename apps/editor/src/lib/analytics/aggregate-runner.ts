import { isBearerMachineAuthorized } from "@magazine/domain";

export const ANALYTICS_AGGREGATION_RUNNER_ERROR = {
  UNAUTHORIZED: "UNAUTHORIZED",
} as const;

export class AnalyticsAggregationRunnerError extends Error {
  readonly code: typeof ANALYTICS_AGGREGATION_RUNNER_ERROR.UNAUTHORIZED;
  readonly status: 401;

  constructor() {
    super(ANALYTICS_AGGREGATION_RUNNER_ERROR.UNAUTHORIZED);
    this.name = "AnalyticsAggregationRunnerError";
    this.code = ANALYTICS_AGGREGATION_RUNNER_ERROR.UNAUTHORIZED;
    this.status = 401;
  }
}

export function assertAnalyticsAggregationAuthorized(
  request: Pick<Request, "headers">,
  expectedSecret: string,
): void {
  if (
    !isBearerMachineAuthorized(
      request.headers.get("authorization"),
      expectedSecret,
    )
  ) {
    throw new AnalyticsAggregationRunnerError();
  }
}
