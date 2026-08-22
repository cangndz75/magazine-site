import { hasCapability } from "../authorization";
import { CAPABILITY } from "../capability";
import { assertExpectedUpdatedAt, nextMonotonicUpdatedAt } from "../editor/concurrency";
import type { StaffRole } from "../staff-role";

export const REDIRECT_STATUS = {
  PERMANENT: "PERMANENT",
} as const;

export type RedirectStatus =
  (typeof REDIRECT_STATUS)[keyof typeof REDIRECT_STATUS];

export const REDIRECT_STATUS_CODE = {
  PERMANENT: 308,
} as const;

export const REDIRECT_RESOLUTION = {
  NONE: "NONE",
  REDIRECT: "REDIRECT",
} as const;

export type RedirectResolution =
  | { kind: typeof REDIRECT_RESOLUTION.NONE }
  | {
      kind: typeof REDIRECT_RESOLUTION.REDIRECT;
      targetPath: string;
      statusCode: 308;
    };

export const REDIRECT_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  SOURCE_INVALID: "SOURCE_INVALID",
  TARGET_INVALID: "TARGET_INVALID",
  SOURCE_CONFLICT: "SOURCE_CONFLICT",
  SOURCE_EQUALS_TARGET: "SOURCE_EQUALS_TARGET",
  REDIRECT_LOOP: "REDIRECT_LOOP",
  REDIRECT_CHAIN: "REDIRECT_CHAIN",
  WRITE_CONFLICT: "WRITE_CONFLICT",
  NOT_FOUND: "NOT_FOUND",
  UNSAFE_AUDIT_PAYLOAD: "UNSAFE_AUDIT_PAYLOAD",
} as const;

export type RedirectErrorCode =
  (typeof REDIRECT_ERROR)[keyof typeof REDIRECT_ERROR];

export class RedirectError extends Error {
  readonly code: RedirectErrorCode;

  constructor(code: RedirectErrorCode, message = code) {
    super(message);
    this.name = "RedirectError";
    this.code = code;
  }
}

export type RedirectRuleRecord = {
  id: string;
  sourcePath: string;
  targetPath: string;
  status: RedirectStatus;
  enabled: boolean;
  note: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type RedirectRulePlan = {
  sourcePath: string;
  targetPath: string;
  status: RedirectStatus;
  enabled: boolean;
  note: string | null;
  updatedAt: Date;
  changeSet: RedirectAuditChangeSet;
};

export type RedirectAuditChangeSet = {
  sourcePath?: { from: string; to: string };
  targetPath?: { from: string; to: string };
  enabled?: { from: boolean; to: boolean };
  note?: { from: string | null; to: string | null };
};

export type RedirectGraphRule = {
  id?: string | null;
  sourcePath: string;
  targetPath: string;
  enabled: boolean;
};

export type NormalizedRedirectPath =
  | { ok: true; value: string }
  | { ok: false; code: typeof REDIRECT_ERROR.SOURCE_INVALID | typeof REDIRECT_ERROR.TARGET_INVALID };

const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/;
const ENCODED_SLASH_OR_BACKSLASH = /%2f|%5c/i;

export function normalizeRedirectPath(
  value: string,
  role: "source" | "target",
): NormalizedRedirectPath {
  const error =
    role === "source" ? REDIRECT_ERROR.SOURCE_INVALID : REDIRECT_ERROR.TARGET_INVALID;
  if (typeof value !== "string") {
    return { ok: false, code: error };
  }
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\") ||
    trimmed.includes("://") ||
    trimmed.includes("?") ||
    trimmed.includes("#") ||
    CONTROL_CHARACTER.test(trimmed) ||
    ENCODED_SLASH_OR_BACKSLASH.test(trimmed)
  ) {
    return { ok: false, code: error };
  }

  try {
    const decoded = decodeURIComponent(trimmed);
    if (
      decoded !== trimmed ||
      decoded.startsWith("//") ||
      decoded.includes("\\") ||
      decoded.includes("://") ||
      CONTROL_CHARACTER.test(decoded)
    ) {
      return { ok: false, code: error };
    }
  } catch {
    return { ok: false, code: error };
  }

  const normalized = trimmed.replace(/\/{2,}/g, "/").replace(/\/+$/g, "") || "/";
  if (normalized === "/" || redirectPathIsReserved(normalized)) {
    return { ok: false, code: error };
  }
  return { ok: true, value: normalized };
}

export function redirectPathIsReserved(path: string): boolean {
  return (
    path === "/api" ||
    path.startsWith("/api/") ||
    path === "/_next" ||
    path.startsWith("/_next/") ||
    path === "/arama" ||
    path.startsWith("/arama/") ||
    path === "/login" ||
    path.startsWith("/login/") ||
    path === "/editor" ||
    path.startsWith("/editor/") ||
    path === "/admin" ||
    path.startsWith("/admin/")
  );
}

export function authorizeRedirectManage(input: {
  roles: readonly StaffRole[];
}): { ok: true } | { ok: false; code: typeof REDIRECT_ERROR.FORBIDDEN } {
  if (!hasCapability(input.roles, CAPABILITY.CONTENT_PUBLISH)) {
    return { ok: false, code: REDIRECT_ERROR.FORBIDDEN };
  }
  return { ok: true };
}

export function decideRedirectCreate(input: {
  sourcePath: string;
  targetPath: string;
  enabled?: boolean;
  note?: string | null;
  now: Date;
}): RedirectRulePlan {
  const source = normalizeRedirectPath(input.sourcePath, "source");
  if (!source.ok) {
    throw new RedirectError(source.code);
  }
  const target = normalizeRedirectPath(input.targetPath, "target");
  if (!target.ok) {
    throw new RedirectError(target.code);
  }
  assertSourceAndTargetDiffer(source.value, target.value);
  return {
    sourcePath: source.value,
    targetPath: target.value,
    status: REDIRECT_STATUS.PERMANENT,
    enabled: input.enabled ?? true,
    note: normalizeRedirectNote(input.note ?? null),
    updatedAt: input.now,
    changeSet: {
      sourcePath: { from: "", to: source.value },
      targetPath: { from: "", to: target.value },
      enabled: { from: false, to: input.enabled ?? true },
    },
  };
}

export function decideRedirectUpdate(input: {
  current: RedirectRuleRecord;
  sourcePath?: string;
  targetPath?: string;
  enabled?: boolean;
  note?: string | null;
  expectedUpdatedAt: Date | string;
  now: Date;
}): RedirectRulePlan {
  const concurrency = assertExpectedUpdatedAt({
    currentUpdatedAt: input.current.updatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (!concurrency.ok) {
    throw new RedirectError(REDIRECT_ERROR.WRITE_CONFLICT);
  }

  const source = normalizeRedirectPath(
    input.sourcePath ?? input.current.sourcePath,
    "source",
  );
  if (!source.ok) {
    throw new RedirectError(source.code);
  }
  const target = normalizeRedirectPath(
    input.targetPath ?? input.current.targetPath,
    "target",
  );
  if (!target.ok) {
    throw new RedirectError(target.code);
  }
  assertSourceAndTargetDiffer(source.value, target.value);

  const enabled = input.enabled ?? input.current.enabled;
  const note = normalizeRedirectNote(input.note ?? input.current.note);
  const changeSet: RedirectAuditChangeSet = {};
  if (input.current.sourcePath !== source.value) {
    changeSet.sourcePath = { from: input.current.sourcePath, to: source.value };
  }
  if (input.current.targetPath !== target.value) {
    changeSet.targetPath = { from: input.current.targetPath, to: target.value };
  }
  if (input.current.enabled !== enabled) {
    changeSet.enabled = { from: input.current.enabled, to: enabled };
  }
  if (input.current.note !== note) {
    changeSet.note = { from: input.current.note, to: note };
  }
  if (!redirectAuditOmitsSecrets(changeSet)) {
    throw new RedirectError(REDIRECT_ERROR.UNSAFE_AUDIT_PAYLOAD);
  }

  return {
    sourcePath: source.value,
    targetPath: target.value,
    status: REDIRECT_STATUS.PERMANENT,
    enabled,
    note,
    updatedAt: nextMonotonicUpdatedAt(input.current.updatedAt, input.now),
    changeSet,
  };
}

export function decideRedirectGraph(input: {
  candidate: RedirectGraphRule;
  existingRules: readonly RedirectGraphRule[];
  maxDepth?: number;
}): { ok: true } | { ok: false; code: typeof REDIRECT_ERROR.REDIRECT_LOOP | typeof REDIRECT_ERROR.REDIRECT_CHAIN } {
  if (!input.candidate.enabled) {
    return { ok: true };
  }
  assertSourceAndTargetDiffer(input.candidate.sourcePath, input.candidate.targetPath);
  const rules = input.existingRules.filter(
    (rule) => rule.enabled && rule.id !== input.candidate.id,
  );
  if (
    rules.some(
      (rule) =>
        rule.sourcePath === input.candidate.targetPath &&
        rule.targetPath === input.candidate.sourcePath,
    )
  ) {
    return { ok: false, code: REDIRECT_ERROR.REDIRECT_LOOP };
  }
  if (rules.some((rule) => rule.sourcePath === input.candidate.targetPath)) {
    return { ok: false, code: REDIRECT_ERROR.REDIRECT_CHAIN };
  }
  if (rules.some((rule) => rule.targetPath === input.candidate.sourcePath)) {
    return { ok: false, code: REDIRECT_ERROR.REDIRECT_CHAIN };
  }

  const bySource = new Map(rules.map((rule) => [rule.sourcePath, rule.targetPath]));
  let next = input.candidate.targetPath;
  const visited = new Set<string>([input.candidate.sourcePath]);
  const maxDepth = input.maxDepth ?? 10;
  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (visited.has(next)) {
      return { ok: false, code: REDIRECT_ERROR.REDIRECT_LOOP };
    }
    visited.add(next);
    const target = bySource.get(next);
    if (!target) {
      return { ok: true };
    }
    next = target;
  }
  return { ok: false, code: REDIRECT_ERROR.REDIRECT_LOOP };
}

export function resolveManualRedirect(
  rule: Pick<RedirectRuleRecord, "targetPath" | "status" | "enabled"> | null,
): RedirectResolution {
  if (!rule || !rule.enabled) {
    return { kind: REDIRECT_RESOLUTION.NONE };
  }
  return {
    kind: REDIRECT_RESOLUTION.REDIRECT,
    targetPath: rule.targetPath,
    statusCode: REDIRECT_STATUS_CODE[rule.status],
  };
}

export function redirectAuditOmitsSecrets(value: unknown): boolean {
  return !containsForbiddenKey(value);
}

function assertSourceAndTargetDiffer(sourcePath: string, targetPath: string): void {
  if (sourcePath === targetPath) {
    throw new RedirectError(REDIRECT_ERROR.SOURCE_EQUALS_TARGET);
  }
}

function normalizeRedirectNote(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
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
