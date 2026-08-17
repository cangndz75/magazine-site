export const CONTENT_AUDIT_EVENT_TYPE = {
  CONTENT_CREATED: "CONTENT_CREATED",
  DRAFT_REVISION_CREATED: "DRAFT_REVISION_CREATED",
  DRAFT_UPDATED: "DRAFT_UPDATED",
  REVIEW_SUBMITTED: "REVIEW_SUBMITTED",
  REVIEW_CHANGES_REQUESTED: "REVIEW_CHANGES_REQUESTED",
  REVIEW_APPROVED: "REVIEW_APPROVED",
  CONTENT_PUBLISHED: "CONTENT_PUBLISHED",
  CONTENT_UNPUBLISHED: "CONTENT_UNPUBLISHED",
  CONTENT_SCHEDULED: "CONTENT_SCHEDULED",
  CONTENT_RESCHEDULED: "CONTENT_RESCHEDULED",
  CONTENT_SCHEDULE_CANCELLED: "CONTENT_SCHEDULE_CANCELLED",
} as const;

export type ContentAuditEventType =
  (typeof CONTENT_AUDIT_EVENT_TYPE)[keyof typeof CONTENT_AUDIT_EVENT_TYPE];

export const CONTENT_AUDIT_EVENT_TYPES = [
  CONTENT_AUDIT_EVENT_TYPE.CONTENT_CREATED,
  CONTENT_AUDIT_EVENT_TYPE.DRAFT_REVISION_CREATED,
  CONTENT_AUDIT_EVENT_TYPE.DRAFT_UPDATED,
  CONTENT_AUDIT_EVENT_TYPE.REVIEW_SUBMITTED,
  CONTENT_AUDIT_EVENT_TYPE.REVIEW_CHANGES_REQUESTED,
  CONTENT_AUDIT_EVENT_TYPE.REVIEW_APPROVED,
  CONTENT_AUDIT_EVENT_TYPE.CONTENT_PUBLISHED,
  CONTENT_AUDIT_EVENT_TYPE.CONTENT_UNPUBLISHED,
  CONTENT_AUDIT_EVENT_TYPE.CONTENT_SCHEDULED,
  CONTENT_AUDIT_EVENT_TYPE.CONTENT_RESCHEDULED,
  CONTENT_AUDIT_EVENT_TYPE.CONTENT_SCHEDULE_CANCELLED,
] as const;

export const CONTENT_AUDIT_ACTOR_KIND = {
  STAFF: "STAFF",
  SYSTEM: "SYSTEM",
} as const;

export type ContentAuditActorKind =
  (typeof CONTENT_AUDIT_ACTOR_KIND)[keyof typeof CONTENT_AUDIT_ACTOR_KIND];

export const CONTENT_AUDIT_ACTOR_KINDS = [
  CONTENT_AUDIT_ACTOR_KIND.STAFF,
  CONTENT_AUDIT_ACTOR_KIND.SYSTEM,
] as const;

export const CONTENT_AUDIT_SCALAR_FIELD = {
  TITLE: "title",
  SUBTITLE: "subtitle",
  EXCERPT: "excerpt",
  SEO_TITLE: "seoTitle",
  SEO_DESCRIPTION: "seoDescription",
  CANONICAL_URL: "canonicalUrl",
  ROBOTS: "robots",
  CREDIBILITY: "credibility",
  CREDIBILITY_SOURCE: "credibilitySource",
  SOURCE: "source",
  SOURCE_ORGANIZATION: "sourceOrganization",
  SOURCE_URL: "sourceUrl",
  SYNDICATED: "syndicated",
  IS_MATERIAL_UPDATE: "isMaterialUpdate",
} as const;

export type ContentAuditScalarField =
  (typeof CONTENT_AUDIT_SCALAR_FIELD)[keyof typeof CONTENT_AUDIT_SCALAR_FIELD];

export type ContentAuditScalarValue = string | boolean | null;

export type ContentAuditScalarChange = {
  field: ContentAuditScalarField;
  before: ContentAuditScalarValue;
  after: ContentAuditScalarValue;
};

export type ContentAuditBodySummary = {
  changed: boolean;
  detailLimited: boolean;
};

export type ContentAuditRelationSummary = {
  relation:
    | "categories"
    | "tags"
    | "entities"
    | "media"
    | "authors";
  beforeCount: number;
  afterCount: number;
  changed: boolean;
  detailLimited: boolean;
};

export type ContentAuditChangeSet = {
  scalarChanges?: ContentAuditScalarChange[];
  bodyChange?: ContentAuditBodySummary;
  relationChanges?: ContentAuditRelationSummary[];
  detailLimited?: boolean;
};

export type ContentAuditActor =
  | { kind: typeof CONTENT_AUDIT_ACTOR_KIND.STAFF; staffUserId: string }
  | { kind: typeof CONTENT_AUDIT_ACTOR_KIND.SYSTEM };

export type ContentAuditEvent = {
  id: string;
  contentItemId: string;
  versionId: string | null;
  eventType: ContentAuditEventType;
  actor: ContentAuditActor;
  occurredAt: Date;
  changeSet: ContentAuditChangeSet | null;
};

export const CONTENT_AUDIT_SCALAR_FIELDS = [
  CONTENT_AUDIT_SCALAR_FIELD.TITLE,
  CONTENT_AUDIT_SCALAR_FIELD.SUBTITLE,
  CONTENT_AUDIT_SCALAR_FIELD.EXCERPT,
  CONTENT_AUDIT_SCALAR_FIELD.SEO_TITLE,
  CONTENT_AUDIT_SCALAR_FIELD.SEO_DESCRIPTION,
  CONTENT_AUDIT_SCALAR_FIELD.CANONICAL_URL,
  CONTENT_AUDIT_SCALAR_FIELD.ROBOTS,
  CONTENT_AUDIT_SCALAR_FIELD.CREDIBILITY,
  CONTENT_AUDIT_SCALAR_FIELD.CREDIBILITY_SOURCE,
  CONTENT_AUDIT_SCALAR_FIELD.SOURCE,
  CONTENT_AUDIT_SCALAR_FIELD.SOURCE_ORGANIZATION,
  CONTENT_AUDIT_SCALAR_FIELD.SOURCE_URL,
  CONTENT_AUDIT_SCALAR_FIELD.SYNDICATED,
  CONTENT_AUDIT_SCALAR_FIELD.IS_MATERIAL_UPDATE,
] as const;

export type ContentAuditScalarInput = Record<
  ContentAuditScalarField,
  ContentAuditScalarValue
>;

export function diffAuditScalarFields(
  before: ContentAuditScalarInput,
  after: ContentAuditScalarInput,
): ContentAuditScalarChange[] {
  return CONTENT_AUDIT_SCALAR_FIELDS.flatMap((field) =>
    before[field] === after[field]
      ? []
      : [{ field, before: before[field], after: after[field] }],
  );
}

export function assertContentAuditChangeSet(
  value: unknown,
): ContentAuditChangeSet | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid content audit change set.");
  }

  const candidate = value as ContentAuditChangeSet;
  if (candidate.scalarChanges !== undefined) {
    if (
      !Array.isArray(candidate.scalarChanges) ||
      candidate.scalarChanges.length > CONTENT_AUDIT_SCALAR_FIELDS.length
    ) {
      throw new Error("Invalid content audit scalar changes.");
    }

    for (const change of candidate.scalarChanges) {
      if (
        !CONTENT_AUDIT_SCALAR_FIELDS.includes(change.field) ||
        !isAuditScalarValue(change.before) ||
        !isAuditScalarValue(change.after)
      ) {
        throw new Error("Invalid content audit scalar change.");
      }
    }
  }

  if (candidate.bodyChange !== undefined) {
    if (
      typeof candidate.bodyChange.changed !== "boolean" ||
      typeof candidate.bodyChange.detailLimited !== "boolean"
    ) {
      throw new Error("Invalid content audit body change.");
    }
  }

  if (candidate.relationChanges !== undefined) {
    if (
      !Array.isArray(candidate.relationChanges) ||
      candidate.relationChanges.length > 5
    ) {
      throw new Error("Invalid content audit relation changes.");
    }

    for (const change of candidate.relationChanges) {
      if (
        !["categories", "tags", "entities", "media", "authors"].includes(
          change.relation,
        ) ||
        !Number.isInteger(change.beforeCount) ||
        !Number.isInteger(change.afterCount) ||
        change.beforeCount < 0 ||
        change.afterCount < 0 ||
        typeof change.changed !== "boolean" ||
        typeof change.detailLimited !== "boolean"
      ) {
        throw new Error("Invalid content audit relation change.");
      }
    }
  }

  if (
    candidate.detailLimited !== undefined &&
    typeof candidate.detailLimited !== "boolean"
  ) {
    throw new Error("Invalid content audit detail limit flag.");
  }

  return candidate;
}

function isAuditScalarValue(value: unknown): value is ContentAuditScalarValue {
  return (
    value === null || typeof value === "string" || typeof value === "boolean"
  );
}
