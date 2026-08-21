import { createHash, randomUUID } from "node:crypto";
import {
  ANALYTICS_APP_ENV,
  ANALYTICS_CLOUDFLARE_TRUST,
  ANALYTICS_CONSENT_STATE,
  ANALYTICS_ERROR,
  ANALYTICS_EVENT_MAX_BYTES,
  ANALYTICS_HTTP_ERROR,
  ANALYTICS_INGEST_STATUS,
  ANALYTICS_OPS_METRIC,
  ANALYTICS_SESSION_POLICY,
  ANALYTICS_VISITOR_POLICY,
  consumeAnalyticsRateLimit,
  decideAnalyticsRequestOrigin,
  isJsonContentType,
  mapAnalyticsErrorToHttp,
  persistentAnalyticsIdentityAllowed,
  type AnalyticsAppEnv,
  type AnalyticsConsentState,
  type AnalyticsEventName,
  type AnalyticsIngestionContext,
  type AnalyticsRateLimitBucket,
  type AnalyticsTrafficKind,
} from "@magazine/domain";
import {
  ingestPublicAnalyticsEvent,
  type IngestPublicAnalyticsEventResult,
} from "@magazine/db/analytics";

export type AnalyticsObserveSignal = {
  metric: string;
  eventName?: AnalyticsEventName | "unknown";
  schemaVersion?: number;
  trafficKind?: AnalyticsTrafficKind;
};

export type AnalyticsIngestHttpDeps = {
  now: () => Date;
  appEnv: AnalyticsAppEnv;
  trustedSiteOrigin: string;
  consentState: AnalyticsConsentState;
  analyticsContextSigningKey: string;
  ingest: (
    input: unknown,
    context: AnalyticsIngestionContext,
  ) => Promise<IngestPublicAnalyticsEventResult>;
  rateLimitBuckets: Map<string, AnalyticsRateLimitBucket>;
  observe: (signal: AnalyticsObserveSignal) => void;
};

const NO_STORE = { "cache-control": "no-store" };

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: NO_STORE,
  });
}

export function observeAnalyticsIngestion(signal: AnalyticsObserveSignal): void {
  console.info(
    JSON.stringify({
      metric: signal.metric,
      eventName: signal.eventName,
      schemaVersion: signal.schemaVersion,
      trafficKind: signal.trafficKind,
    }),
  );
}

const defaultBuckets = new Map<string, AnalyticsRateLimitBucket>();

export function defaultAnalyticsIngestDeps(input: {
  appEnv: AnalyticsAppEnv;
  trustedSiteOrigin: string;
  analyticsContextSigningKey: string;
}): AnalyticsIngestHttpDeps {
  return {
    now: () => new Date(),
    appEnv: input.appEnv,
    trustedSiteOrigin: input.trustedSiteOrigin,
    consentState: ANALYTICS_CONSENT_STATE.UNKNOWN,
    analyticsContextSigningKey: input.analyticsContextSigningKey,
    ingest: ingestPublicAnalyticsEvent,
    rateLimitBuckets: defaultBuckets,
    observe: observeAnalyticsIngestion,
  };
}

function analyticsAppEnvFrom(appEnv: string): AnalyticsAppEnv {
  if (
    appEnv === ANALYTICS_APP_ENV.PRODUCTION ||
    appEnv === ANALYTICS_APP_ENV.STAGING ||
    appEnv === ANALYTICS_APP_ENV.TEST ||
    appEnv === ANALYTICS_APP_ENV.DEVELOPMENT
  ) {
    return appEnv;
  }
  return ANALYTICS_APP_ENV.DEVELOPMENT;
}

export function createWebAnalyticsIngestDeps(input: {
  appEnv: string;
  siteUrl: string;
  analyticsContextSigningKey: string;
}): AnalyticsIngestHttpDeps {
  return defaultAnalyticsIngestDeps({
    appEnv: analyticsAppEnvFrom(input.appEnv),
    trustedSiteOrigin: new URL(input.siteUrl).origin,
    analyticsContextSigningKey: input.analyticsContextSigningKey,
  });
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

function analyticsSessionCookie(input: {
  value: string;
  appEnv: AnalyticsAppEnv;
  maxAgeSeconds: number;
}): string {
  const secure =
    input.appEnv === ANALYTICS_APP_ENV.PRODUCTION ||
    input.appEnv === ANALYTICS_APP_ENV.STAGING;
  const parts = [
    `${ANALYTICS_SESSION_POLICY.COOKIE_NAME}=${input.value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${input.maxAgeSeconds}`,
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

function rateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`analytics-rate:${first}`).digest("hex");
}

function requestLooksLikeJson(request: Request): boolean {
  return isJsonContentType(request.headers.get("content-type"));
}

export async function handleAnalyticsIngestPost(
  request: Request,
  deps: AnalyticsIngestHttpDeps,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        status: ANALYTICS_INGEST_STATUS.REJECTED,
        error: ANALYTICS_HTTP_ERROR.METHOD_NOT_ALLOWED,
      },
      405,
    );
  }

  if (!requestLooksLikeJson(request)) {
    deps.observe({ metric: ANALYTICS_OPS_METRIC.REJECTED_VALIDATION, eventName: "unknown" });
    return jsonResponse(
      {
        status: ANALYTICS_INGEST_STATUS.REJECTED,
        error: ANALYTICS_HTTP_ERROR.UNSUPPORTED_MEDIA_TYPE,
      },
      415,
    );
  }

  const origin = decideAnalyticsRequestOrigin({
    originHeader: request.headers.get("origin"),
    refererHeader: request.headers.get("referer"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    trustedSiteOrigin: deps.trustedSiteOrigin,
  });
  if (!origin.ok) {
    deps.observe({ metric: ANALYTICS_OPS_METRIC.REJECTED_VALIDATION, eventName: "unknown" });
    return jsonResponse(
      {
        status: ANALYTICS_INGEST_STATUS.REJECTED,
        error: ANALYTICS_HTTP_ERROR.ORIGIN_REJECTED,
      },
      403,
    );
  }

  const now = deps.now();
  const bucketKey = rateLimitKey(request);
  const limited = consumeAnalyticsRateLimit({
    nowMs: now.getTime(),
    bucket: deps.rateLimitBuckets.get(bucketKey),
  });
  deps.rateLimitBuckets.set(bucketKey, limited.bucket);
  if (!limited.allowed) {
    deps.observe({ metric: ANALYTICS_OPS_METRIC.REJECTED_RATE_LIMIT, eventName: "unknown" });
    return jsonResponse(
      {
        status: ANALYTICS_INGEST_STATUS.REJECTED,
        error: ANALYTICS_HTTP_ERROR.RATE_LIMITED,
      },
      429,
    );
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const size = Number(contentLength);
    if (!Number.isFinite(size) || size > ANALYTICS_EVENT_MAX_BYTES) {
      deps.observe({ metric: ANALYTICS_OPS_METRIC.REJECTED_VALIDATION, eventName: "unknown" });
      return jsonResponse(
        {
          status: ANALYTICS_INGEST_STATUS.REJECTED,
          error: ANALYTICS_HTTP_ERROR.EVENT_TOO_LARGE,
        },
        413,
      );
    }
  }

  const bodyBuffer = await request.arrayBuffer();
  if (bodyBuffer.byteLength > ANALYTICS_EVENT_MAX_BYTES) {
    deps.observe({ metric: ANALYTICS_OPS_METRIC.REJECTED_VALIDATION, eventName: "unknown" });
    return jsonResponse(
      {
        status: ANALYTICS_INGEST_STATUS.REJECTED,
        error: ANALYTICS_HTTP_ERROR.EVENT_TOO_LARGE,
      },
      413,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(bodyBuffer)) as unknown;
  } catch {
    deps.observe({ metric: ANALYTICS_OPS_METRIC.REJECTED_VALIDATION, eventName: "unknown" });
    return jsonResponse(
      {
        status: ANALYTICS_INGEST_STATUS.REJECTED,
        error: ANALYTICS_HTTP_ERROR.INVALID_EVENT,
      },
      400,
    );
  }

  const cookieSession = cookieValue(request, ANALYTICS_SESSION_POLICY.COOKIE_NAME);
  const sessionId = persistentAnalyticsIdentityAllowed(deps.consentState)
    ? cookieSession && cookieSession.length === 36
      ? cookieSession
      : randomUUID()
    : null;

  void ANALYTICS_VISITOR_POLICY.DURABLE_VISITOR_ID_ENABLED;
  void ANALYTICS_CLOUDFLARE_TRUST.TRUST_BOT_HEADERS;

  const context: AnalyticsIngestionContext = {
    receivedAt: now,
    appEnv: deps.appEnv,
    consentState: deps.consentState,
    trustedSiteOrigin: deps.trustedSiteOrigin,
    referrerUrl: request.headers.get("referer"),
    anonymousSessionId: sessionId,
    analyticsContextSigningKey: deps.analyticsContextSigningKey,
    trafficSignals: {
      userAgent: request.headers.get("user-agent"),
      cloudflareVerifiedBot: false,
      trustedInternalEvidence: false,
      trustedTestEvidence: false,
    },
  };

  let ingested: IngestPublicAnalyticsEventResult;
  try {
    ingested = await deps.ingest(payload, context);
  } catch {
    deps.observe({ metric: ANALYTICS_OPS_METRIC.STORAGE_ERROR, eventName: "unknown" });
    return jsonResponse(
      {
        status: ANALYTICS_INGEST_STATUS.REJECTED,
        error: ANALYTICS_HTTP_ERROR.STORAGE_ERROR,
      },
      500,
    );
  }

  if (!ingested.ok) {
    const mapped = mapAnalyticsErrorToHttp(ingested.code);
    const metric =
      ingested.code === ANALYTICS_ERROR.RATE_LIMITED
        ? ANALYTICS_OPS_METRIC.REJECTED_RATE_LIMIT
        : ANALYTICS_OPS_METRIC.REJECTED_VALIDATION;
    deps.observe({ metric, eventName: "unknown" });
    return jsonResponse(
      {
        status:
          ingested.code === ANALYTICS_ERROR.EVENT_ID_CONFLICT
            ? ANALYTICS_INGEST_STATUS.CONFLICT
            : ANALYTICS_INGEST_STATUS.REJECTED,
        error: mapped.error,
      },
      mapped.status,
    );
  }

  const metric =
    ingested.value.outcome === "DEDUPLICATED"
      ? ANALYTICS_OPS_METRIC.DEDUPLICATED
      : ANALYTICS_OPS_METRIC.ACCEPTED;
  deps.observe({
    metric,
    eventName: ingested.value.event.eventName,
    schemaVersion: ingested.value.event.schemaVersion,
    trafficKind: ingested.value.event.trafficKind,
  });

  const response = jsonResponse(
    {
      status:
        ingested.value.outcome === "DEDUPLICATED"
          ? ANALYTICS_INGEST_STATUS.DEDUPLICATED
          : ANALYTICS_INGEST_STATUS.ACCEPTED,
    },
    202,
  );
  if (persistentAnalyticsIdentityAllowed(deps.consentState) && sessionId) {
    response.headers.set(
      "set-cookie",
      analyticsSessionCookie({
        value: sessionId,
        appEnv: deps.appEnv,
        maxAgeSeconds: ANALYTICS_SESSION_POLICY.INACTIVITY_TIMEOUT_MS / 1000,
      }),
    );
  }
  return response;
}

export function handleAnalyticsIngestMethodNotAllowed(): Response {
  return jsonResponse(
    {
      status: ANALYTICS_INGEST_STATUS.REJECTED,
      error: ANALYTICS_HTTP_ERROR.METHOD_NOT_ALLOWED,
    },
    405,
  );
}
