import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  mediaLicenseTypeEnum,
  mediaSourceKindEnum,
  mediaTypeEnum,
  mediaUsageRestrictionEnum,
} from "./enums";

export const media = pgTable(
  "media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storageKey: text("storage_key").notNull(),
    mediaType: mediaTypeEnum("media_type").notNull(),
    mimeType: text("mime_type").notNull(),
    width: integer("width"),
    height: integer("height"),
    byteSize: integer("byte_size").notNull(),
    originalFilename: text("original_filename"),
    contentHash: text("content_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sourceKind: mediaSourceKindEnum("source_kind").notNull().default("UNKNOWN"),
    sourceName: text("source_name"),
    creatorName: text("creator_name"),
    rightsHolder: text("rights_holder"),
    licenseType: mediaLicenseTypeEnum("license_type").notNull().default("UNKNOWN"),
    licenseReference: text("license_reference"),
    licenseNote: text("license_note"),
    licenseStartsAt: timestamp("license_starts_at", { withTimezone: true }),
    licenseExpiresAt: timestamp("license_expires_at", { withTimezone: true }),
    creditLine: text("credit_line"),
    usageRestriction: mediaUsageRestrictionEnum("usage_restriction")
      .notNull()
      .default("NONE"),
    territoryRestriction: text("territory_restriction"),
  },
  (table) => [
    unique("media_storage_key_key").on(table.storageKey),
    check("media_byte_size_non_negative", sql`${table.byteSize} >= 0`),
    check(
      "media_original_filename_length",
      sql`${table.originalFilename} IS NULL OR char_length(${table.originalFilename}) BETWEEN 1 AND 200`,
    ),
    check(
      "media_content_hash_sha256",
      sql`${table.contentHash} IS NULL OR char_length(${table.contentHash}) = 64`,
    ),
    check("media_width_positive", sql`${table.width} IS NULL OR ${table.width} > 0`),
    check(
      "media_height_positive",
      sql`${table.height} IS NULL OR ${table.height} > 0`,
    ),
    check(
      "media_license_window_valid",
      sql`${table.licenseExpiresAt} IS NULL
        OR ${table.licenseStartsAt} IS NULL
        OR ${table.licenseExpiresAt} > ${table.licenseStartsAt}`,
    ),
    check(
      "media_source_name_length",
      sql`${table.sourceName} IS NULL OR char_length(${table.sourceName}) BETWEEN 1 AND 200`,
    ),
    check(
      "media_creator_name_length",
      sql`${table.creatorName} IS NULL OR char_length(${table.creatorName}) BETWEEN 1 AND 200`,
    ),
    check(
      "media_rights_holder_length",
      sql`${table.rightsHolder} IS NULL OR char_length(${table.rightsHolder}) BETWEEN 1 AND 200`,
    ),
    check(
      "media_license_reference_length",
      sql`${table.licenseReference} IS NULL OR char_length(${table.licenseReference}) BETWEEN 1 AND 200`,
    ),
    check(
      "media_license_note_length",
      sql`${table.licenseNote} IS NULL OR char_length(${table.licenseNote}) BETWEEN 1 AND 4000`,
    ),
    check(
      "media_credit_line_length",
      sql`${table.creditLine} IS NULL OR char_length(${table.creditLine}) BETWEEN 1 AND 200`,
    ),
    check(
      "media_territory_restriction_length",
      sql`${table.territoryRestriction} IS NULL OR char_length(${table.territoryRestriction}) BETWEEN 1 AND 200`,
    ),
    index("media_license_expires_at_idx")
      .on(table.licenseExpiresAt)
      .where(sql`${table.licenseExpiresAt} IS NOT NULL`),
  ],
);
