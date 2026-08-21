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
  VIDEO_PROVIDERS,
  WORKFLOW_STATUSES,
  CONTENT_LEGAL_ACTION_TYPES,
  CONTENT_LEGAL_ACTION_POLARITIES,
  CONTENT_LEGAL_REASON_CATEGORIES,
  STAFF_MFA_FACTOR_KINDS,
  STAFF_MFA_FACTOR_STATUSES,
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

export const videoProviderEnum = pgEnum("video_provider", VIDEO_PROVIDERS);

export const contentLegalActionTypeEnum = pgEnum(
  "content_legal_action_type",
  CONTENT_LEGAL_ACTION_TYPES,
);

export const contentLegalActionPolarityEnum = pgEnum(
  "content_legal_action_polarity",
  CONTENT_LEGAL_ACTION_POLARITIES,
);

export const contentLegalReasonCategoryEnum = pgEnum(
  "content_legal_reason_category",
  CONTENT_LEGAL_REASON_CATEGORIES,
);

export const staffMfaFactorKindEnum = pgEnum(
  "staff_mfa_factor_kind",
  STAFF_MFA_FACTOR_KINDS,
);

export const staffMfaFactorStatusEnum = pgEnum(
  "staff_mfa_factor_status",
  STAFF_MFA_FACTOR_STATUSES,
);
