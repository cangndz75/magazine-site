import { pgEnum } from "drizzle-orm/pg-core";
import {
  AUTHOR_ROLES,
  CREDIBILITY_VALUES,
  ENTITY_KINDS,
  ENTITY_ROLES,
  MEDIA_LICENSE_TYPES,
  MEDIA_ROLES,
  MEDIA_SOURCE_KINDS,
  MEDIA_TYPES,
  MEDIA_USAGE_RESTRICTIONS,
  PUBLICATION_STATUSES,
  REVIEW_EVENT_TYPES,
  STAFF_ROLES,
  STAFF_SCOPE_MODES,
  STAFF_STATUSES,
  WORKFLOW_STATUSES,
} from "@magazine/domain";

export const publicationStatusEnum = pgEnum(
  "publication_status",
  PUBLICATION_STATUSES,
);

export const workflowStatusEnum = pgEnum("workflow_status", WORKFLOW_STATUSES);

export const credibilityEnum = pgEnum("credibility", CREDIBILITY_VALUES);

export const entityKindEnum = pgEnum("entity_kind", ENTITY_KINDS);

export const entityRoleEnum = pgEnum("entity_role", ENTITY_ROLES);

export const mediaTypeEnum = pgEnum("media_type", MEDIA_TYPES);

export const mediaRoleEnum = pgEnum("media_role", MEDIA_ROLES);

export const mediaSourceKindEnum = pgEnum("media_source_kind", MEDIA_SOURCE_KINDS);

export const mediaLicenseTypeEnum = pgEnum(
  "media_license_type",
  MEDIA_LICENSE_TYPES,
);

export const mediaUsageRestrictionEnum = pgEnum(
  "media_usage_restriction",
  MEDIA_USAGE_RESTRICTIONS,
);

export const authorRoleEnum = pgEnum("author_role", AUTHOR_ROLES);

export const staffStatusEnum = pgEnum("staff_status", STAFF_STATUSES);

export const staffScopeModeEnum = pgEnum("staff_scope_mode", STAFF_SCOPE_MODES);

export const staffRoleEnum = pgEnum("staff_role", STAFF_ROLES);

export const reviewEventTypeEnum = pgEnum(
  "review_event_type",
  REVIEW_EVENT_TYPES,
);
