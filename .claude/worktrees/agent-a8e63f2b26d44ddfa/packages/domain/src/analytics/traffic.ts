import { ANALYTICS_REFERRER_HOST_MAX_LENGTH, ANALYTICS_UTM_MAX_LENGTH } from "./policy";
import {
  ANALYTICS_APP_ENV,
  ANALYTICS_TRAFFIC_KIND,
  ANALYTICS_TRAFFIC_SOURCE,
  type AnalyticsAppEnv,
  type AnalyticsTrafficKind,
  type AnalyticsTrafficSource,
} from "./taxonomy";

const SEARCH_HOSTS = new Set([
  "google.com",
  "google.com.tr",
  "bing.com",
  "duckduckgo.com",
  "yahoo.com",
  "yandex.com",
  "yandex.com.tr",
  "baidu.com",
  "ecosia.org",
]);

const SOCIAL_HOSTS = new Set([
  "facebook.com",
  "fb.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "t.co",
  "tiktok.com",
  "linkedin.com",
  "lnkd.in",
  "pinterest.com",
  "reddit.com",
  "whatsapp.com",
  "telegram.org",
  "t.me",
  "threads.net",
  "youtube.com",
  "youtu.be",
]);

const BOT_USER_AGENT_TOKENS = [
  "googlebot",
  "bingbot",
  "slurp",
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "applebot",
  "semrushbot",
  "ahrefsbot",
  "mj12bot",
  "dotbot",
  "gptbot",
  "claudebot",
  "bytespider",
  "petalsearch",
  "pingdom",
  "uptimerobot",
  "statuscake",
  "preview",
  "crawler",
  "spider",
  "bot/",
] as const;

const UTM_VALUE_PATTERN = /^[a-z0-9._-]{1,100}$/;

export type AnalyticsUtmFields = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
};

export type AnalyticsTrafficSignals = {
  userAgent?: string | null;
  cloudflareVerifiedBot?: boolean;
  trustedInternalEvidence?: boolean;
  trustedTestEvidence?: boolean;
};

export type ClassifyAnalyticsTrafficSourceInput = {
  referrerUrl?: string | null;
  trustedSiteOrigin: string;
};

/**
 * Hostname-only classification. This is not exhaustive global provider
 * intelligence and is not campaign attribution.
 */
export function normalizeAnalyticsHostname(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length === 0 || trimmed.length > ANALYTICS_REFERRER_HOST_MAX_LENGTH) {
    return null;
  }
  const withoutPort = trimmed.replace(/:\d+$/, "");
  if (withoutPort.startsWith("www.")) {
    return withoutPort.slice(4);
  }
  return withoutPort;
}

function hostnameFromReferrer(referrerUrl: string | null | undefined): string | null {
  if (referrerUrl === undefined || referrerUrl === null) {
    return null;
  }
  const trimmed = referrerUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return normalizeAnalyticsHostname(parsed.hostname);
  } catch {
    return null;
  }
}

function registrableLikeHost(hostname: string): string {
  const parts = hostname.split(".");
  if (parts.length <= 2) {
    return hostname;
  }
  return parts.slice(-2).join(".");
}

export function classifyAnalyticsTrafficSource(
  input: ClassifyAnalyticsTrafficSourceInput,
): {
  source: AnalyticsTrafficSource;
  referrerHost: string | null;
} {
  const host = hostnameFromReferrer(input.referrerUrl);
  if (host === null) {
    return { source: ANALYTICS_TRAFFIC_SOURCE.DIRECT, referrerHost: null };
  }

  let trustedHost: string | null = null;
  try {
    trustedHost = normalizeAnalyticsHostname(new URL(input.trustedSiteOrigin).hostname);
  } catch {
    trustedHost = null;
  }

  if (trustedHost !== null && host === trustedHost) {
    return { source: ANALYTICS_TRAFFIC_SOURCE.INTERNAL, referrerHost: host };
  }

  const bucketHost = registrableLikeHost(host);
  if (SEARCH_HOSTS.has(host) || SEARCH_HOSTS.has(bucketHost)) {
    return { source: ANALYTICS_TRAFFIC_SOURCE.SEARCH, referrerHost: host };
  }
  if (SOCIAL_HOSTS.has(host) || SOCIAL_HOSTS.has(bucketHost)) {
    return { source: ANALYTICS_TRAFFIC_SOURCE.SOCIAL, referrerHost: host };
  }

  return { source: ANALYTICS_TRAFFIC_SOURCE.REFERRAL, referrerHost: host };
}

export function userAgentLooksLikeKnownBot(userAgent: string | null | undefined): boolean {
  if (userAgent === undefined || userAgent === null) {
    return false;
  }
  const lowered = userAgent.toLowerCase();
  return BOT_USER_AGENT_TOKENS.some((token) => lowered.includes(token));
}

/**
 * Server-derived traffic kind. Client booleans and spoofable query parameters
 * are not inputs. Non-production environments are TEST. This is not an access
 * control decision.
 */
export function classifyAnalyticsTrafficKind(input: {
  appEnv: AnalyticsAppEnv;
  signals: AnalyticsTrafficSignals;
}): AnalyticsTrafficKind {
  if (
    input.appEnv !== ANALYTICS_APP_ENV.PRODUCTION ||
    input.signals.trustedTestEvidence === true
  ) {
    return ANALYTICS_TRAFFIC_KIND.TEST;
  }

  if (input.signals.trustedInternalEvidence === true) {
    return ANALYTICS_TRAFFIC_KIND.INTERNAL;
  }

  if (
    input.signals.cloudflareVerifiedBot === true ||
    userAgentLooksLikeKnownBot(input.signals.userAgent)
  ) {
    return ANALYTICS_TRAFFIC_KIND.BOT;
  }

  return ANALYTICS_TRAFFIC_KIND.HUMAN;
}

export function canonicalizeAnalyticsUtmValue(
  raw: string | null | undefined,
): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }
  const normalized = raw.trim().toLowerCase().slice(0, ANALYTICS_UTM_MAX_LENGTH);
  if (normalized.length === 0) {
    return null;
  }
  if (!UTM_VALUE_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

export function canonicalizeAnalyticsUtm(input: {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
}): AnalyticsUtmFields {
  return {
    source: canonicalizeAnalyticsUtmValue(input.source),
    medium: canonicalizeAnalyticsUtmValue(input.medium),
    campaign: canonicalizeAnalyticsUtmValue(input.campaign),
  };
}
