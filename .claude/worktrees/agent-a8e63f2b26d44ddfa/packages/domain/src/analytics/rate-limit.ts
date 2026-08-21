import { ANALYTICS_RATE_LIMIT_POLICY } from "./policy";

export type AnalyticsRateLimitBucket = {
  windowStartedAtMs: number;
  count: number;
};

export type AnalyticsRateLimitDecision = {
  allowed: boolean;
  bucket: AnalyticsRateLimitBucket;
};

/**
 * Sliding fixed-window counter. Not a distributed production control.
 * Cloudflare edge rate limiting is required in hosted production.
 */
export function consumeAnalyticsRateLimit(input: {
  nowMs: number;
  bucket: AnalyticsRateLimitBucket | undefined;
  maxRequests?: number;
  windowMs?: number;
}): AnalyticsRateLimitDecision {
  const maxRequests =
    input.maxRequests ?? ANALYTICS_RATE_LIMIT_POLICY.MAX_REQUESTS_PER_WINDOW;
  const windowMs = input.windowMs ?? ANALYTICS_RATE_LIMIT_POLICY.WINDOW_MS;
  const current = input.bucket;

  if (
    current === undefined ||
    input.nowMs - current.windowStartedAtMs >= windowMs
  ) {
    return {
      allowed: true,
      bucket: { windowStartedAtMs: input.nowMs, count: 1 },
    };
  }

  const nextCount = current.count + 1;
  if (nextCount > maxRequests) {
    return {
      allowed: false,
      bucket: { ...current, count: nextCount },
    };
  }

  return {
    allowed: true,
    bucket: { ...current, count: nextCount },
  };
}
