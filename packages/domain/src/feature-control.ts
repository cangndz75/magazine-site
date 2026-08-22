import { hasCapability } from "./authorization";
import { CAPABILITY } from "./capability";
import { assertExpectedUpdatedAt, nextMonotonicUpdatedAt } from "./editor/concurrency";
import type { StaffRole } from "./staff-role";

export const FEATURE_CONTROL_TYPE = {
  FEATURE_FLAG: "FEATURE_FLAG",
  KILL_SWITCH: "KILL_SWITCH",
} as const;

export type FeatureControlType =
  (typeof FEATURE_CONTROL_TYPE)[keyof typeof FEATURE_CONTROL_TYPE];

export const FEATURE_FLAG_KEY = {
  PUBLIC_SEARCH: "PUBLIC_SEARCH",
  PUBLIC_GALLERIES: "PUBLIC_GALLERIES",
  EDITORIAL_CALENDAR: "EDITORIAL_CALENDAR",
} as const;

export type FeatureFlagKey =
  (typeof FEATURE_FLAG_KEY)[keyof typeof FEATURE_FLAG_KEY];

export const KILL_SWITCH_KEY = {
  ANALYTICS_INGESTION: "ANALYTICS_INGESTION",
  SCHEDULED_PUBLISHING: "SCHEDULED_PUBLISHING",
  PUBLIC_VIDEO: "PUBLIC_VIDEO",
  HOMEPAGE_CONVERSATION: "HOMEPAGE_CONVERSATION",
} as const;

export type KillSwitchKey =
  (typeof KILL_SWITCH_KEY)[keyof typeof KILL_SWITCH_KEY];

export type FeatureControlKey = FeatureFlagKey | KillSwitchKey;

export const FEATURE_CONTROL_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  UNKNOWN_KEY: "UNKNOWN_KEY",
  TYPE_MISMATCH: "TYPE_MISMATCH",
  WRITE_CONFLICT: "WRITE_CONFLICT",
  UNSAFE_AUDIT_PAYLOAD: "UNSAFE_AUDIT_PAYLOAD",
} as const;

export type FeatureControlErrorCode =
  (typeof FEATURE_CONTROL_ERROR)[keyof typeof FEATURE_CONTROL_ERROR];

export class FeatureControlError extends Error {
  readonly code: FeatureControlErrorCode;

  constructor(code: FeatureControlErrorCode, message = code) {
    super(message);
    this.name = "FeatureControlError";
    this.code = code;
  }
}

export type FeatureControlDefinition = {
  key: FeatureControlKey;
  type: FeatureControlType;
  defaultEnabled: boolean;
  description: string;
};

export const FEATURE_CONTROL_DEFINITIONS = [
  {
    key: FEATURE_FLAG_KEY.PUBLIC_SEARCH,
    type: FEATURE_CONTROL_TYPE.FEATURE_FLAG,
    defaultEnabled: true,
    description: "Controls public search result serving.",
  },
  {
    key: FEATURE_FLAG_KEY.PUBLIC_GALLERIES,
    type: FEATURE_CONTROL_TYPE.FEATURE_FLAG,
    defaultEnabled: true,
    description: "Controls public photo gallery serving.",
  },
  {
    key: FEATURE_FLAG_KEY.EDITORIAL_CALENDAR,
    type: FEATURE_CONTROL_TYPE.FEATURE_FLAG,
    defaultEnabled: true,
    description: "Controls the editorial calendar server surface.",
  },
  {
    key: KILL_SWITCH_KEY.ANALYTICS_INGESTION,
    type: FEATURE_CONTROL_TYPE.KILL_SWITCH,
    defaultEnabled: false,
    description: "Stops public analytics ingestion when enabled.",
  },
  {
    key: KILL_SWITCH_KEY.SCHEDULED_PUBLISHING,
    type: FEATURE_CONTROL_TYPE.KILL_SWITCH,
    defaultEnabled: false,
    description: "Stops scheduled publishing execution when enabled.",
  },
  {
    key: KILL_SWITCH_KEY.PUBLIC_VIDEO,
    type: FEATURE_CONTROL_TYPE.KILL_SWITCH,
    defaultEnabled: false,
    description: "Hides public hosted video projections when enabled.",
  },
  {
    key: KILL_SWITCH_KEY.HOMEPAGE_CONVERSATION,
    type: FEATURE_CONTROL_TYPE.KILL_SWITCH,
    defaultEnabled: false,
    description: "Hides the public homepage conversation rail when enabled.",
  },
] as const satisfies readonly FeatureControlDefinition[];

export const FEATURE_CONTROL_KEYS = FEATURE_CONTROL_DEFINITIONS.map(
  (definition) => definition.key,
) as readonly FeatureControlKey[];

const DEFINITIONS_BY_KEY = new Map<FeatureControlKey, FeatureControlDefinition>(
  FEATURE_CONTROL_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export type FeatureControlRecord = {
  key: string;
  type: string;
  enabled: boolean;
  description: string | null;
  updatedAt: Date | string | null;
};

export type ResolvedFeatureControl = {
  key: FeatureControlKey;
  type: FeatureControlType;
  enabled: boolean;
  description: string;
  updatedAt: string | null;
  source: "PERSISTED" | "DEFAULT";
};

export type FeatureControlUpdatePlan = {
  key: FeatureControlKey;
  type: FeatureControlType;
  enabled: boolean;
  description: string;
  updatedAt: Date;
  changeSet: FeatureControlAuditChangeSet;
};

export type FeatureControlAuditChangeSet = {
  enabled?: { from: boolean; to: boolean };
  description?: { from: string; to: string };
};

export function isFeatureControlKey(value: string): value is FeatureControlKey {
  return DEFINITIONS_BY_KEY.has(value as FeatureControlKey);
}

export function getFeatureControlDefinition(
  key: string,
): FeatureControlDefinition {
  const definition = DEFINITIONS_BY_KEY.get(key as FeatureControlKey);
  if (!definition) {
    throw new FeatureControlError(FEATURE_CONTROL_ERROR.UNKNOWN_KEY);
  }
  return definition;
}

export function resolveFeatureControl(
  key: string,
  record: FeatureControlRecord | null,
): ResolvedFeatureControl {
  const definition = getFeatureControlDefinition(key);
  if (record && record.type !== definition.type) {
    throw new FeatureControlError(FEATURE_CONTROL_ERROR.TYPE_MISMATCH);
  }

  const source = record ? "PERSISTED" : "DEFAULT";
  return {
    key: definition.key,
    type: definition.type,
    enabled: record?.enabled ?? definition.defaultEnabled,
    description: record?.description ?? definition.description,
    updatedAt: iso(record?.updatedAt ?? null),
    source,
  };
}

export function featureIsEnabled(control: Pick<ResolvedFeatureControl, "type" | "enabled">): boolean {
  if (control.type !== FEATURE_CONTROL_TYPE.FEATURE_FLAG) {
    throw new FeatureControlError(FEATURE_CONTROL_ERROR.TYPE_MISMATCH);
  }
  return control.enabled;
}

export function killSwitchIsActive(control: Pick<ResolvedFeatureControl, "type" | "enabled">): boolean {
  if (control.type !== FEATURE_CONTROL_TYPE.KILL_SWITCH) {
    throw new FeatureControlError(FEATURE_CONTROL_ERROR.TYPE_MISMATCH);
  }
  return control.enabled;
}

export function authorizeFeatureControlManage(input: {
  roles: readonly StaffRole[];
}): { ok: true } | { ok: false; code: typeof FEATURE_CONTROL_ERROR.FORBIDDEN } {
  if (!hasCapability(input.roles, CAPABILITY.STAFF_MANAGE)) {
    return { ok: false, code: FEATURE_CONTROL_ERROR.FORBIDDEN };
  }
  return { ok: true };
}

export function decideFeatureControlUpdate(input: {
  current: FeatureControlRecord;
  expectedUpdatedAt: Date | string;
  enabled: boolean;
  description?: string | null;
  now: Date;
}): FeatureControlUpdatePlan {
  const definition = getFeatureControlDefinition(input.current.key);
  if (input.current.type !== definition.type) {
    throw new FeatureControlError(FEATURE_CONTROL_ERROR.TYPE_MISMATCH);
  }
  if (input.current.updatedAt === null) {
    throw new FeatureControlError(FEATURE_CONTROL_ERROR.WRITE_CONFLICT);
  }

  const concurrency = assertExpectedUpdatedAt({
    expectedUpdatedAt: input.expectedUpdatedAt,
    currentUpdatedAt: input.current.updatedAt,
  });
  if (!concurrency.ok) {
    throw new FeatureControlError(FEATURE_CONTROL_ERROR.WRITE_CONFLICT);
  }

  const description = normalizeDescription(
    input.description ?? input.current.description ?? definition.description,
  );
  const previousDescription = normalizeDescription(
    input.current.description ?? definition.description,
  );
  const changeSet: FeatureControlAuditChangeSet = {};
  if (input.current.enabled !== input.enabled) {
    changeSet.enabled = { from: input.current.enabled, to: input.enabled };
  }
  if (previousDescription !== description) {
    changeSet.description = { from: previousDescription, to: description };
  }

  if (!featureControlAuditOmitsSecrets(changeSet)) {
    throw new FeatureControlError(FEATURE_CONTROL_ERROR.UNSAFE_AUDIT_PAYLOAD);
  }

  return {
    key: definition.key,
    type: definition.type,
    enabled: input.enabled,
    description,
    updatedAt: nextMonotonicUpdatedAt(input.current.updatedAt, input.now),
    changeSet,
  };
}

export function featureControlAuditOmitsSecrets(value: unknown): boolean {
  return !containsForbiddenKey(value);
}

function normalizeDescription(value: string): string {
  return value.trim().slice(0, 500);
}

function iso(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

const FORBIDDEN_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "tokenHash",
  "secret",
  "secretCiphertext",
  "databaseUrl",
  "connectionString",
]);

function containsForbiddenKey(value: unknown): boolean {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(containsForbiddenKey);
  }
  return Object.entries(value).some(
    ([key, child]) => FORBIDDEN_KEYS.has(key) || containsForbiddenKey(child),
  );
}
