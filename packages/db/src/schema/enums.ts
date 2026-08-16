import { pgEnum } from "drizzle-orm/pg-core";
import {
  AUTHOR_ROLES,
  CREDIBILITY_VALUES,
  ENTITY_KINDS,
  ENTITY_ROLES,
  MEDIA_ROLES,
  MEDIA_TYPES,
  PUBLICATION_STATUSES,
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

export const authorRoleEnum = pgEnum("author_role", AUTHOR_ROLES);

export const staffStatusEnum = pgEnum("staff_status", STAFF_STATUSES);

export const staffScopeModeEnum = pgEnum("staff_scope_mode", STAFF_SCOPE_MODES);

export const staffRoleEnum = pgEnum("staff_role", STAFF_ROLES);
