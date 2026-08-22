import { hasCapability } from "./authorization";
import { CAPABILITY } from "./capability";
import type { StaffRole } from "./staff-role";

export const SITE_HEALTH_STATUS = {
  HEALTHY: "HEALTHY",
  DEGRADED: "DEGRADED",
  UNAVAILABLE: "UNAVAILABLE",
  ATTENTION: "ATTENTION",
} as const;

export type SiteHealthStatus =
  (typeof SITE_HEALTH_STATUS)[keyof typeof SITE_HEALTH_STATUS];

export type SiteHealthSignalAvailability =
  | "AVAILABLE"
  | "PARTIAL"
  | "UNAVAILABLE"
  | "NOT_APPROPRIATE";

export type SiteHealthSection<TMetrics extends Record<string, unknown>> = {
  status: SiteHealthStatus;
  availability: SiteHealthSignalAvailability;
  label: string;
  summary: string;
  updatedAt: string | null;
  metrics: TMetrics;
  actionTarget: string | null;
};

export type SiteHealthDto = {
  generatedAt: string;
  overall: {
    status: SiteHealthStatus;
    label: string;
    summary: string;
  };
  database: SiteHealthSection<{
    available: boolean;
    queryTimestamp: string | null;
  }>;
  outbox: SiteHealthSection<{
    pending: number | null;
    processing: number | null;
    dead: number | null;
  }>;
  scheduledPublishing: SiteHealthSection<{
    scheduledCount: number | null;
    overdueCount: number | null;
    nextScheduledAt: string | null;
  }>;
  analytics: SiteHealthSection<{
    availability: "AVAILABLE" | "UNAVAILABLE";
    reason: string | null;
    lastSuccessfulThrough: string | null;
    lastCompletedAt: string | null;
  }>;
  seo: SiteHealthSection<{
    healthy: number | null;
    attention: number | null;
    critical: number | null;
  }>;
  homepage: SiteHealthSection<{
    liveVersionAvailable: boolean | null;
    lastPublishedAt: string | null;
    publishedSlotCount: number | null;
    activeConversationItemCount: number | null;
  }>;
  media: SiteHealthSection<{
    total: number | null;
    rightsIneligible: number | null;
    expiredLicenses: number | null;
    missingCredit: number | null;
  }>;
  cache: SiteHealthSection<{
    runtimeObservable: boolean;
    invalidationOutboxObservable: boolean;
    pending: number | null;
    processing: number | null;
    dead: number | null;
  }>;
};

export function deriveSiteHealthOverallStatus(
  statuses: readonly SiteHealthStatus[],
): SiteHealthStatus {
  if (statuses.includes(SITE_HEALTH_STATUS.UNAVAILABLE)) {
    return SITE_HEALTH_STATUS.UNAVAILABLE;
  }
  if (statuses.includes(SITE_HEALTH_STATUS.ATTENTION)) {
    return SITE_HEALTH_STATUS.ATTENTION;
  }
  if (statuses.includes(SITE_HEALTH_STATUS.DEGRADED)) {
    return SITE_HEALTH_STATUS.DEGRADED;
  }
  return SITE_HEALTH_STATUS.HEALTHY;
}

export function authorizeSiteHealthRead(input: {
  roles: readonly StaffRole[];
}): { ok: true } | { ok: false; code: "FORBIDDEN" } {
  if (!hasCapability(input.roles, CAPABILITY.STAFF_MANAGE)) {
    return { ok: false, code: "FORBIDDEN" };
  }
  return { ok: true };
}

const FORBIDDEN_SITE_HEALTH_KEYS = new Set([
  "body",
  "storageKey",
  "rightsNote",
  "internalNote",
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "mfaSecret",
  "secretCiphertext",
  "recoveryCode",
  "recoveryCodes",
  "codeHash",
  "auditPayload",
  "eventId",
  "anonymousId",
  "anonId",
  "databaseUrl",
  "connectionString",
  "secret",
  "storageBucket",
  "storageKey",
]);

export function assertSafeSiteHealthDto(value: unknown): void {
  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (FORBIDDEN_SITE_HEALTH_KEYS.has(key)) {
        throw new Error(`Site Health DTO contains forbidden key: ${path}.${key}`);
      }
      visit(child, path ? `${path}.${key}` : key);
    }
  };

  visit(value, "siteHealth");
}
