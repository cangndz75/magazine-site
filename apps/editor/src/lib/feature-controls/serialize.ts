import {
  featureControlAuditOmitsSecrets,
  type FeatureControlKey,
  type FeatureControlType,
} from "@magazine/domain";
import type {
  FeatureControlAuditProjection,
  ResolvedFeatureControlWithActor,
} from "@magazine/db/feature-controls";

export type FeatureControlHttpDto = {
  key: FeatureControlKey;
  type: FeatureControlType;
  enabled: boolean;
  description: string;
  updatedAt: string | null;
  source: "PERSISTED" | "DEFAULT";
  updatedByDisplayName: string | null;
};

export type FeatureControlAuditHttpDto = {
  controlKey: FeatureControlKey;
  controlType: FeatureControlType;
  oldEnabled: boolean;
  newEnabled: boolean;
  occurredAt: string;
  actorDisplayName: string;
};

const FORBIDDEN_HTTP_TOKENS = [
  "passwordHash",
  "tokenHash",
  "secretCiphertext",
  "databaseUrl",
  "connectionString",
  "recoveryCode",
];

export function serializeFeatureControl(
  control: ResolvedFeatureControlWithActor,
): FeatureControlHttpDto {
  return {
    key: control.key,
    type: control.type,
    enabled: control.enabled,
    description: control.description,
    updatedAt: control.updatedAt,
    source: control.source,
    updatedByDisplayName: control.updatedByDisplayName,
  };
}

export function serializeFeatureControlAuditEvent(
  event: FeatureControlAuditProjection,
): FeatureControlAuditHttpDto {
  return {
    controlKey: event.controlKey,
    controlType: event.controlType,
    oldEnabled: event.oldEnabled,
    newEnabled: event.newEnabled,
    occurredAt: event.occurredAt,
    actorDisplayName: event.actorDisplayName,
  };
}

export function assertSafeFeatureControlHttpPayload(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const token of FORBIDDEN_HTTP_TOKENS) {
    if (serialized.includes(token)) {
      throw new Error("Unsafe feature control HTTP payload.");
    }
  }
  if (!featureControlAuditOmitsSecrets(value)) {
    throw new Error("Unsafe feature control HTTP payload.");
  }
}
