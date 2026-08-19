import {
  PUBLIC_CACHE_INVALIDATION_ERROR,
  PublicCacheInvalidationError,
  assertPublicCacheInvalidationAuthorized,
} from "./public-cache-invalidation-auth";
import {
  invalidatePublicArticleCacheFromEvent,
  readPublicArticleCacheInvalidateEvent,
} from "./public-cache-invalidation";

export async function handlePublicCacheInvalidationPost(
  request: Request,
  secret: string,
  invalidate: typeof invalidatePublicArticleCacheFromEvent = invalidatePublicArticleCacheFromEvent,
): Promise<Response> {
  try {
    assertPublicCacheInvalidationAuthorized(request, secret);
    const body = await readJsonObject(request);
    const event = readPublicArticleCacheInvalidateEvent(body);
    await invalidate(event);
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(
        { ok: false, error: PUBLIC_CACHE_INVALIDATION_ERROR.INVALID_REQUEST },
        400,
      );
    }

    if (error instanceof PublicCacheInvalidationError) {
      return jsonResponse({ ok: false, error: error.code }, error.status);
    }

    throw error;
  }
}

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

async function readJsonObject(
  request: Request,
): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.trim().length === 0) {
    throw new SyntaxError("Invalid JSON body.");
  }

  const parsed = JSON.parse(text) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SyntaxError("Invalid JSON body.");
  }

  return parsed as Record<string, unknown>;
}
