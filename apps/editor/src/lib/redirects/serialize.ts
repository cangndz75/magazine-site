import { redirectAuditOmitsSecrets } from "@magazine/domain";
import type {
  RedirectAuditProjection,
  RedirectRuleProjection,
} from "@magazine/db/redirects";

export type RedirectRuleHttpDto = {
  id: string;
  sourcePath: string;
  targetPath: string;
  status: "PERMANENT";
  enabled: boolean;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  updatedByDisplayName: string | null;
};

export type RedirectAuditHttpDto = {
  occurredAt: string;
  actorDisplayName: string;
  sourcePath: string;
  oldTargetPath: string | null;
  newTargetPath: string | null;
  oldEnabled: boolean | null;
  newEnabled: boolean;
};

const FORBIDDEN_HTTP_TOKENS = [
  "passwordHash",
  "tokenHash",
  "secretCiphertext",
  "databaseUrl",
  "connectionString",
];

export function serializeRedirectRule(rule: RedirectRuleProjection): RedirectRuleHttpDto {
  return {
    id: rule.id,
    sourcePath: rule.sourcePath,
    targetPath: rule.targetPath,
    status: rule.status,
    enabled: rule.enabled,
    note: rule.note,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    updatedByDisplayName: rule.updatedByDisplayName,
  };
}

export function serializeRedirectAuditEvent(
  event: RedirectAuditProjection,
): RedirectAuditHttpDto {
  return {
    occurredAt: event.occurredAt,
    actorDisplayName: event.actorDisplayName,
    sourcePath: event.sourcePath,
    oldTargetPath: event.oldTargetPath,
    newTargetPath: event.newTargetPath,
    oldEnabled: event.oldEnabled,
    newEnabled: event.newEnabled,
  };
}

export function assertSafeRedirectHttpPayload(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const token of FORBIDDEN_HTTP_TOKENS) {
    if (serialized.includes(token)) {
      throw new Error("Unsafe redirect HTTP payload.");
    }
  }
  if (!redirectAuditOmitsSecrets(value)) {
    throw new Error("Unsafe redirect HTTP payload.");
  }
}
