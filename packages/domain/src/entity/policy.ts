import { hasCapability } from "../authorization";
import { CAPABILITY } from "../capability";
import { assertExpectedUpdatedAt } from "../editor/concurrency";
import { isUuid } from "../editor/query-bounds";
import { ENTITY_KIND, ENTITY_KINDS } from "../entity-kind";
import { STAFF_ROLE, type StaffRole } from "../staff-role";
import { canonicalizeEntityAliasSet } from "./alias";
import { canonicalizeEntityCanonicalName, canonicalizeEntitySlug } from "./identity";
import {
  ENTITY_ERROR,
  ENTITY_STATUS,
  ENTITY_STATUSES,
  ENTITY_TEXT_MAX,
  type CanonicalEntityProfileWrite,
  type EntityDecision,
  type EntityKind,
  type EntityProfileWriteInput,
  type EntityStatus,
} from "./types";

export const ENTITY_AUDIT_EVENT_TYPE = {
  ENTITY_CREATED: "ENTITY_CREATED",
  ENTITY_UPDATED: "ENTITY_UPDATED",
  ENTITY_SLUG_CHANGED: "ENTITY_SLUG_CHANGED",
  ENTITY_ARCHIVED: "ENTITY_ARCHIVED",
  ENTITY_REACTIVATED: "ENTITY_REACTIVATED",
  ENTITY_MERGED: "ENTITY_MERGED",
} as const;

export type EntityAuditEventType =
  (typeof ENTITY_AUDIT_EVENT_TYPE)[keyof typeof ENTITY_AUDIT_EVENT_TYPE];

export const ENTITY_AUDIT_EVENT_TYPES = [
  ENTITY_AUDIT_EVENT_TYPE.ENTITY_CREATED,
  ENTITY_AUDIT_EVENT_TYPE.ENTITY_UPDATED,
  ENTITY_AUDIT_EVENT_TYPE.ENTITY_SLUG_CHANGED,
  ENTITY_AUDIT_EVENT_TYPE.ENTITY_ARCHIVED,
  ENTITY_AUDIT_EVENT_TYPE.ENTITY_REACTIVATED,
  ENTITY_AUDIT_EVENT_TYPE.ENTITY_MERGED,
] as const;

export const ENTITY_AUDIT_SCALAR_FIELD = {
  KIND: "kind",
  STATUS: "status",
  CANONICAL_NAME: "canonicalName",
  SLUG: "slug",
  SUMMARY: "summary",
  PORTRAIT_MEDIA_ID: "portraitMediaId",
  BIRTH_DATE: "birthDate",
  OCCUPATION: "occupation",
  OFFICIAL_WEBSITE_URL: "officialWebsiteUrl",
  ALIAS_COUNT: "aliasCount",
  MERGED_INTO_ENTITY_ID: "mergedIntoEntityId",
} as const;

/**
 * Pass 2/3 recommendation. Pass 1 reuses CONTENT_READ for picker access and
 * role checks for catalog writes so ROLE_CAPABILITIES is not churned.
 */
export const ENTITY_CAPABILITY_RECOMMENDATION = {
  ADD_CAPABILITIES: ["ENTITY_READ", "ENTITY_EDIT", "ENTITY_MANAGE"] as const,
  AUTHOR: "select existing entities on drafts via CONTENT_READ; no catalog admin",
  EDITOR: "create/update/archive/reactivate; no merge",
  SUPER_ADMIN: "full catalog including merge",
} as const;

export const ENTITY_DELETION_POLICY = {
  ORDINARY_WORKFLOW: "ARCHIVE",
  HARD_DELETE: "RESTRICTED_WHILE_RELATIONS_EXIST",
  ARCHIVE_KEEPS_CONTENT_VERSION_RELATIONS: true,
} as const;

export const ENTITY_MERGE_PRESERVE = [
  "article_relationships",
  "aliases",
  "timeline",
  "historical_references",
  "profile_url_redirects",
  "audit_history",
] as const;

export type EntityMergePlan = {
  survivingEntityId: string;
  retiredEntityId: string;
  retiredStatus: typeof ENTITY_STATUS.ARCHIVED;
  mergedIntoEntityId: string;
  preserve: typeof ENTITY_MERGE_PRESERVE;
};

const PERSON_ONLY_KINDS = new Set<EntityKind>([ENTITY_KIND.PERSON]);

function isEntityKind(value: string): value is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(value);
}

function isEntityStatus(value: string): value is EntityStatus {
  return (ENTITY_STATUSES as readonly string[]).includes(value);
}

function canonicalizeOptionalText(
  raw: string | null | undefined,
  max: number,
  invalid: typeof ENTITY_ERROR.INVALID_PROFILE,
): EntityDecision<string | null> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  const trimmed = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (trimmed.length > max) {
    return { ok: false, code: invalid };
  }
  return { ok: true, value: trimmed };
}

function canonicalizeOptionalUuid(
  raw: string | null | undefined,
): EntityDecision<string | null> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: true, value: null };
  }
  if (!isUuid(value)) {
    return { ok: false, code: ENTITY_ERROR.INVALID_MEDIA };
  }
  return { ok: true, value: value.toLowerCase() };
}

function canonicalizeBirthDate(
  raw: string | null | undefined,
): EntityDecision<string | null> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: true, value: null };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return { ok: false, code: ENTITY_ERROR.INVALID_PROFILE };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return { ok: false, code: ENTITY_ERROR.INVALID_PROFILE };
  }
  return { ok: true, value: value };
}

function canonicalizeOfficialWebsiteUrl(
  raw: string | null | undefined,
): EntityDecision<string | null> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, code: ENTITY_ERROR.INVALID_URL };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, code: ENTITY_ERROR.INVALID_URL };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, code: ENTITY_ERROR.INVALID_URL };
  }
  return { ok: true, value: parsed.toString() };
}

export function entityStatusFromLegacyIsActive(isActive: boolean): EntityStatus {
  return isActive ? ENTITY_STATUS.ACTIVE : ENTITY_STATUS.ARCHIVED;
}

export function legacyIsActiveFromEntityStatus(status: EntityStatus): boolean {
  return status === ENTITY_STATUS.ACTIVE;
}

export function authorizeEntityRead(input: {
  roles: readonly StaffRole[];
}): EntityDecision<true> {
  if (!hasCapability(input.roles, CAPABILITY.CONTENT_READ)) {
    return { ok: false, code: ENTITY_ERROR.FORBIDDEN };
  }
  return { ok: true, value: true };
}

export function authorizeEntitySelect(input: {
  roles: readonly StaffRole[];
}): EntityDecision<true> {
  return authorizeEntityRead(input);
}

export function authorizeEntityWrite(input: {
  roles: readonly StaffRole[];
}): EntityDecision<true> {
  if (
    input.roles.includes(STAFF_ROLE.SUPER_ADMIN) ||
    input.roles.includes(STAFF_ROLE.EDITOR)
  ) {
    return { ok: true, value: true };
  }
  return { ok: false, code: ENTITY_ERROR.FORBIDDEN };
}

export function authorizeEntityManage(input: {
  roles: readonly StaffRole[];
}): EntityDecision<true> {
  if (!input.roles.includes(STAFF_ROLE.SUPER_ADMIN)) {
    return { ok: false, code: ENTITY_ERROR.FORBIDDEN };
  }
  return { ok: true, value: true };
}

export function assertEntityExpectedUpdatedAt(input: {
  currentUpdatedAt: Date | string;
  expectedUpdatedAt: Date | string;
}): EntityDecision<true> {
  const token = assertExpectedUpdatedAt(input);
  if (!token.ok) {
    return { ok: false, code: ENTITY_ERROR.ENTITY_WRITE_CONFLICT };
  }
  return { ok: true, value: true };
}

export function canonicalizeEntityProfileWrite(
  input: EntityProfileWriteInput,
): EntityDecision<CanonicalEntityProfileWrite> {
  if (!isEntityKind(input.kind)) {
    return { ok: false, code: ENTITY_ERROR.INVALID_KIND };
  }

  const statusRaw = input.status ?? ENTITY_STATUS.DRAFT;
  if (!isEntityStatus(statusRaw)) {
    return { ok: false, code: ENTITY_ERROR.INVALID_STATUS };
  }

  const canonicalName = canonicalizeEntityCanonicalName(input.canonicalName);
  if (!canonicalName.ok) {
    return canonicalName;
  }
  const slug = canonicalizeEntitySlug(input.slug);
  if (!slug.ok) {
    return slug;
  }
  const summary = canonicalizeOptionalText(
    input.summary,
    ENTITY_TEXT_MAX.SUMMARY,
    ENTITY_ERROR.INVALID_PROFILE,
  );
  if (!summary.ok) {
    return summary;
  }
  const biography = canonicalizeOptionalText(
    input.biography,
    ENTITY_TEXT_MAX.BIOGRAPHY,
    ENTITY_ERROR.INVALID_PROFILE,
  );
  if (!biography.ok) {
    return biography;
  }
  const occupation = canonicalizeOptionalText(
    input.occupation,
    ENTITY_TEXT_MAX.OCCUPATION,
    ENTITY_ERROR.INVALID_PROFILE,
  );
  if (!occupation.ok) {
    return occupation;
  }
  const portraitMediaId = canonicalizeOptionalUuid(input.portraitMediaId);
  if (!portraitMediaId.ok) {
    return portraitMediaId;
  }
  const birthDate = canonicalizeBirthDate(input.birthDate);
  if (!birthDate.ok) {
    return birthDate;
  }
  const officialWebsiteUrl = canonicalizeOfficialWebsiteUrl(
    input.officialWebsiteUrl,
  );
  if (!officialWebsiteUrl.ok) {
    return officialWebsiteUrl;
  }
  const aliases = canonicalizeEntityAliasSet(input.aliases);
  if (!aliases.ok) {
    return aliases;
  }

  if (
    !PERSON_ONLY_KINDS.has(input.kind) &&
    (birthDate.value !== null || occupation.value !== null)
  ) {
    return { ok: false, code: ENTITY_ERROR.INVALID_PROFILE };
  }

  return {
    ok: true,
    value: {
      kind: input.kind,
      status: statusRaw,
      canonicalName: canonicalName.value,
      slug: slug.value,
      summary: summary.value,
      biography: biography.value,
      portraitMediaId: portraitMediaId.value,
      birthDate: birthDate.value,
      occupation: occupation.value,
      officialWebsiteUrl: officialWebsiteUrl.value,
      aliases: aliases.value,
    },
  };
}

export type EntityUpdatePlan = CanonicalEntityProfileWrite & {
  slugChanged: boolean;
  previousSlug: string;
};

export function decideEntityUpdate(input: {
  current: {
    entityId: string;
    slug: string;
    status: EntityStatus;
    deletedAt: Date | string | null;
    mergedIntoEntityId: string | null;
    updatedAt: Date | string;
  };
  write: EntityProfileWriteInput;
  expectedUpdatedAt: Date | string;
}): EntityDecision<EntityUpdatePlan> {
  if (input.current.deletedAt != null) {
    return { ok: false, code: ENTITY_ERROR.ENTITY_DELETED };
  }

  const concurrency = assertEntityExpectedUpdatedAt({
    currentUpdatedAt: input.current.updatedAt,
    expectedUpdatedAt: input.expectedUpdatedAt,
  });
  if (!concurrency.ok) {
    return concurrency;
  }

  const canonical = canonicalizeEntityProfileWrite(input.write);
  if (!canonical.ok) {
    return canonical;
  }

  const currentSlug = canonicalizeEntitySlug(input.current.slug);
  if (!currentSlug.ok) {
    return currentSlug;
  }

  return {
    ok: true,
    value: {
      ...canonical.value,
      previousSlug: currentSlug.value,
      slugChanged: currentSlug.value !== canonical.value.slug,
    },
  };
}

export function decideEntityArchive(input: {
  status: EntityStatus;
  deletedAt: Date | string | null;
}): EntityDecision<typeof ENTITY_STATUS.ARCHIVED> {
  if (input.deletedAt != null) {
    return { ok: false, code: ENTITY_ERROR.ENTITY_DELETED };
  }
  if (input.status === ENTITY_STATUS.ARCHIVED) {
    return { ok: true, value: ENTITY_STATUS.ARCHIVED };
  }
  return { ok: true, value: ENTITY_STATUS.ARCHIVED };
}

export function decideEntityReactivate(input: {
  status: EntityStatus;
  deletedAt: Date | string | null;
  mergedIntoEntityId: string | null;
}): EntityDecision<typeof ENTITY_STATUS.ACTIVE> {
  if (input.deletedAt != null) {
    return { ok: false, code: ENTITY_ERROR.ENTITY_DELETED };
  }
  if (input.mergedIntoEntityId !== null) {
    return { ok: false, code: ENTITY_ERROR.INVALID_MERGE };
  }
  if (input.status === ENTITY_STATUS.DRAFT) {
    return { ok: true, value: ENTITY_STATUS.ACTIVE };
  }
  return { ok: true, value: ENTITY_STATUS.ACTIVE };
}

/**
 * Merge is not executed in this pass. The plan names what must survive.
 * The retired entity is archived and redirected; it is never hard-deleted.
 */
export function decideEntityMerge(input: {
  survivingEntityId: string;
  retiredEntityId: string;
}): EntityDecision<EntityMergePlan> {
  if (
    !isUuid(input.survivingEntityId) ||
    !isUuid(input.retiredEntityId) ||
    input.survivingEntityId === input.retiredEntityId
  ) {
    return { ok: false, code: ENTITY_ERROR.INVALID_MERGE };
  }

  return {
    ok: true,
    value: {
      survivingEntityId: input.survivingEntityId,
      retiredEntityId: input.retiredEntityId,
      retiredStatus: ENTITY_STATUS.ARCHIVED,
      mergedIntoEntityId: input.survivingEntityId,
      preserve: ENTITY_MERGE_PRESERVE,
    },
  };
}

export type EntityAuditScalarSummary = {
  field: (typeof ENTITY_AUDIT_SCALAR_FIELD)[keyof typeof ENTITY_AUDIT_SCALAR_FIELD];
  before: string | number | null;
  after: string | number | null;
};

export function summarizeEntityAuditScalars(input: {
  before: {
    kind: string;
    status: string;
    canonicalName: string;
    slug: string;
    summary: string | null;
    portraitMediaId: string | null;
    birthDate: string | null;
    occupation: string | null;
    officialWebsiteUrl: string | null;
    aliasCount: number;
    mergedIntoEntityId: string | null;
  };
  after: {
    kind: string;
    status: string;
    canonicalName: string;
    slug: string;
    summary: string | null;
    portraitMediaId: string | null;
    birthDate: string | null;
    occupation: string | null;
    officialWebsiteUrl: string | null;
    aliasCount: number;
    mergedIntoEntityId: string | null;
  };
}): EntityAuditScalarSummary[] {
  const fields: EntityAuditScalarSummary[] = [];
  const pairs: Array<{
    field: EntityAuditScalarSummary["field"];
    before: string | number | null;
    after: string | number | null;
  }> = [
    {
      field: ENTITY_AUDIT_SCALAR_FIELD.KIND,
      before: input.before.kind,
      after: input.after.kind,
    },
    {
      field: ENTITY_AUDIT_SCALAR_FIELD.STATUS,
      before: input.before.status,
      after: input.after.status,
    },
    {
      field: ENTITY_AUDIT_SCALAR_FIELD.CANONICAL_NAME,
      before: input.before.canonicalName,
      after: input.after.canonicalName,
    },
    {
      field: ENTITY_AUDIT_SCALAR_FIELD.SLUG,
      before: input.before.slug,
      after: input.after.slug,
    },
    {
      field: ENTITY_AUDIT_SCALAR_FIELD.SUMMARY,
      before: input.before.summary,
      after: input.after.summary,
    },
    {
      field: ENTITY_AUDIT_SCALAR_FIELD.PORTRAIT_MEDIA_ID,
      before: input.before.portraitMediaId,
      after: input.after.portraitMediaId,
    },
    {
      field: ENTITY_AUDIT_SCALAR_FIELD.BIRTH_DATE,
      before: input.before.birthDate,
      after: input.after.birthDate,
    },
    {
      field: ENTITY_AUDIT_SCALAR_FIELD.OCCUPATION,
      before: input.before.occupation,
      after: input.after.occupation,
    },
    {
      field: ENTITY_AUDIT_SCALAR_FIELD.OFFICIAL_WEBSITE_URL,
      before: input.before.officialWebsiteUrl,
      after: input.after.officialWebsiteUrl,
    },
    {
      field: ENTITY_AUDIT_SCALAR_FIELD.ALIAS_COUNT,
      before: input.before.aliasCount,
      after: input.after.aliasCount,
    },
    {
      field: ENTITY_AUDIT_SCALAR_FIELD.MERGED_INTO_ENTITY_ID,
      before: input.before.mergedIntoEntityId,
      after: input.after.mergedIntoEntityId,
    },
  ];

  for (const pair of pairs) {
    if (pair.before !== pair.after) {
      fields.push(pair);
    }
  }
  return fields;
}
