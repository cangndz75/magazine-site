import {
  PUBLIC_CACHE_OUTBOX_EVENT_TYPE,
  PUBLIC_ENTITY_CACHE_INVALIDATE_SCHEMA_VERSION,
  PUBLIC_CACHE_INVALIDATION_PATH,
} from "@magazine/domain";

export const PUBLIC_CACHE_INVALIDATION_TIMEOUT_MS = 5_000;
export const PUBLIC_CACHE_INVALIDATION_ERROR_MAX_LENGTH = 200;

export type PublicArticleCacheDeliveryTarget = {
  contentItemId: string;
  slug: string;
};

export type PublicEntityCacheDeliveryTarget = {
  entityId: string;
  slug: string;
  eventType:
    | typeof PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_CACHE_INVALIDATE
    | typeof PUBLIC_CACHE_OUTBOX_EVENT_TYPE.PUBLIC_ENTITY_RELATED_CACHE_INVALIDATE;
};

export type PublicArticleCacheDeliveryConfig = {
  baseUrl: string;
  secret: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export function joinPublicWebInternalUrl(
  baseUrl: string,
  pathname: string = PUBLIC_CACHE_INVALIDATION_PATH,
): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new Error("PUBLIC_WEB_INTERNAL_BASE_URL is malformed.");
  }

  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new Error("PUBLIC_WEB_INTERNAL_BASE_URL must be an http(s) URL.");
  }

  if (base.username || base.password) {
    throw new Error("PUBLIC_WEB_INTERNAL_BASE_URL must not include credentials.");
  }

  const originWithPath = `${base.origin}${base.pathname.replace(/\/+$/, "")}/`;
  const relativePath = pathname.replace(/^\/+/, "");
  return new URL(relativePath, originWithPath).toString();
}

export async function deliverPublicArticleCacheInvalidation(
  target: PublicArticleCacheDeliveryTarget,
  config: PublicArticleCacheDeliveryConfig,
): Promise<void> {
  await postPublicCacheInvalidation(
    {
      schemaVersion: 1,
      contentItemId: target.contentItemId,
      slug: target.slug,
    },
    config,
  );
}

export async function deliverPublicEntityCacheInvalidation(
  target: PublicEntityCacheDeliveryTarget,
  config: PublicArticleCacheDeliveryConfig,
): Promise<void> {
  await postPublicCacheInvalidation(
    {
      eventType: target.eventType,
      payload: {
        schemaVersion: PUBLIC_ENTITY_CACHE_INVALIDATE_SCHEMA_VERSION,
        entityId: target.entityId,
        slug: target.slug,
      },
    },
    config,
  );
}

async function postPublicCacheInvalidation(
  body: unknown,
  config: PublicArticleCacheDeliveryConfig,
): Promise<void> {
  const url = joinPublicWebInternalUrl(config.baseUrl);
  const timeoutMs = config.timeoutMs ?? PUBLIC_CACHE_INVALIDATION_TIMEOUT_MS;
  const fetchImpl = config.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.secret}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(transportFailureMessage(error), { cause: error });
  } finally {
    clearTimeout(timer);
  }

  if (response.ok) {
    return;
  }

  throw new Error(
    `Public web cache invalidation failed (${response.status}).`,
  );
}

function transportFailureMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "Public web cache invalidation timed out.";
  }

  return boundErrorDetail("Public web cache invalidation transport failed.");
}

export function boundErrorDetail(message: string): string {
  return message.slice(0, PUBLIC_CACHE_INVALIDATION_ERROR_MAX_LENGTH);
}
