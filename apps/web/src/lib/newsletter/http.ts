import {
  ANALYTICS_HTTP_ERROR,
  consumeAnalyticsRateLimit,
  decideAnalyticsRequestOrigin,
  isJsonContentType,
  newsletterSafePublicSignupResponse,
  type AnalyticsRateLimitBucket,
} from "@magazine/domain";
import {
  confirmNewsletterSubscription,
  requestNewsletterSignup,
  unsubscribeNewsletter,
  type NewsletterConfirmResult,
  type NewsletterUnsubscribeResult,
} from "@magazine/db/newsletter";

export type NewsletterHttpDeps = {
  now: () => Date;
  trustedSiteOrigin: string;
  rateLimitBuckets: Map<string, AnalyticsRateLimitBucket>;
  signup: typeof requestNewsletterSignup;
  confirm: typeof confirmNewsletterSubscription;
  unsubscribe: typeof unsubscribeNewsletter;
};

const NO_STORE = { "cache-control": "no-store" };
const NEWSLETTER_MAX_BODY_BYTES = 2048;
const NEWSLETTER_RATE_LIMIT_MAX = 10;
const NEWSLETTER_RATE_LIMIT_WINDOW_MS = 1000 * 60 * 10;
const defaultBuckets = new Map<string, AnalyticsRateLimitBucket>();

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function createNewsletterHttpDeps(input: {
  siteUrl: string;
}): NewsletterHttpDeps {
  return {
    now: () => new Date(),
    trustedSiteOrigin: new URL(input.siteUrl).origin,
    rateLimitBuckets: defaultBuckets,
    signup: requestNewsletterSignup,
    confirm: confirmNewsletterSubscription,
    unsubscribe: unsubscribeNewsletter,
  };
}

export async function handleNewsletterSubscribePost(
  request: Request,
  deps: NewsletterHttpDeps,
): Promise<Response> {
  const prelim = await validatePublicMutationRequest(request, deps);
  if (prelim) {
    return prelim;
  }
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) {
    return jsonResponse({ status: "REJECTED", error: "INVALID_JSON" }, 400);
  }
  const body = parsed.value as {
    email?: unknown;
    consentVersion?: unknown;
    surface?: unknown;
  };
  try {
    await deps.signup({
      email: body.email,
      source: "PUBLIC_API",
      consentVersion: body.consentVersion,
      surface: body.surface,
      now: deps.now(),
    });
    return jsonResponse(newsletterSafePublicSignupResponse(), 202);
  } catch {
    return jsonResponse({ status: "REJECTED", error: "INVALID_EMAIL" }, 400);
  }
}

export async function handleNewsletterConfirmRequest(
  request: Request,
  deps: NewsletterHttpDeps,
): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result: NewsletterConfirmResult = await deps.confirm({ token, now: deps.now() });
  return jsonResponse(result, result.status === "CONFIRMED" ? 200 : 400);
}

export async function handleNewsletterUnsubscribeRequest(
  request: Request,
  deps: NewsletterHttpDeps,
): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result: NewsletterUnsubscribeResult = await deps.unsubscribe({
    token,
    now: deps.now(),
  });
  return jsonResponse(result, result.status === "INVALID_OR_EXPIRED" ? 400 : 200);
}

export function handleNewsletterMethodNotAllowed(): Response {
  return jsonResponse({ status: "REJECTED", error: "METHOD_NOT_ALLOWED" }, 405);
}

async function validatePublicMutationRequest(
  request: Request,
  deps: NewsletterHttpDeps,
): Promise<Response | null> {
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return jsonResponse(
      { status: "REJECTED", error: ANALYTICS_HTTP_ERROR.UNSUPPORTED_MEDIA_TYPE },
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
    return jsonResponse(
      { status: "REJECTED", error: ANALYTICS_HTTP_ERROR.ORIGIN_REJECTED },
      403,
    );
  }
  const limited = consumeAnalyticsRateLimit({
    nowMs: deps.now().getTime(),
    bucket: deps.rateLimitBuckets.get(rateLimitKey(request)),
    maxRequests: NEWSLETTER_RATE_LIMIT_MAX,
    windowMs: NEWSLETTER_RATE_LIMIT_WINDOW_MS,
  });
  deps.rateLimitBuckets.set(rateLimitKey(request), limited.bucket);
  if (!limited.allowed) {
    return jsonResponse(
      { status: "REJECTED", error: ANALYTICS_HTTP_ERROR.RATE_LIMITED },
      429,
    );
  }
  return null;
}

async function parseJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const size = Number(contentLength);
    if (!Number.isFinite(size) || size > NEWSLETTER_MAX_BODY_BYTES) {
      return { ok: false };
    }
  }
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > NEWSLETTER_MAX_BODY_BYTES) {
    return { ok: false };
  }
  try {
    return { ok: true, value: JSON.parse(Buffer.from(buffer).toString("utf8")) };
  } catch {
    return { ok: false };
  }
}

function rateLimitKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
