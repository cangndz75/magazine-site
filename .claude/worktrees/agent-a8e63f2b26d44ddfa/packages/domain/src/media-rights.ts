import { hasCapability } from "./authorization";
import { CAPABILITY } from "./capability";
import type { StaffRole } from "./staff-role";

export const MEDIA_SOURCE_KIND = {
  UNKNOWN: "UNKNOWN",
  OWNED: "OWNED",
  COMMISSIONED: "COMMISSIONED",
  LICENSED: "LICENSED",
  AGENCY: "AGENCY",
  UGC: "UGC",
} as const;

export type MediaSourceKind =
  (typeof MEDIA_SOURCE_KIND)[keyof typeof MEDIA_SOURCE_KIND];

export const MEDIA_SOURCE_KINDS = [
  MEDIA_SOURCE_KIND.UNKNOWN,
  MEDIA_SOURCE_KIND.OWNED,
  MEDIA_SOURCE_KIND.COMMISSIONED,
  MEDIA_SOURCE_KIND.LICENSED,
  MEDIA_SOURCE_KIND.AGENCY,
  MEDIA_SOURCE_KIND.UGC,
] as const;

export const MEDIA_LICENSE_TYPE = {
  UNKNOWN: "UNKNOWN",
  ALL_RIGHTS: "ALL_RIGHTS",
  COMMISSIONED: "COMMISSIONED",
  EDITORIAL: "EDITORIAL",
  CREATIVE_COMMONS: "CREATIVE_COMMONS",
  OTHER: "OTHER",
} as const;

export type MediaLicenseType =
  (typeof MEDIA_LICENSE_TYPE)[keyof typeof MEDIA_LICENSE_TYPE];

export const MEDIA_LICENSE_TYPES = [
  MEDIA_LICENSE_TYPE.UNKNOWN,
  MEDIA_LICENSE_TYPE.ALL_RIGHTS,
  MEDIA_LICENSE_TYPE.COMMISSIONED,
  MEDIA_LICENSE_TYPE.EDITORIAL,
  MEDIA_LICENSE_TYPE.CREATIVE_COMMONS,
  MEDIA_LICENSE_TYPE.OTHER,
] as const;

export const MEDIA_USAGE_RESTRICTION = {
  NONE: "NONE",
  EDITORIAL_ONLY: "EDITORIAL_ONLY",
  RESTRICTED: "RESTRICTED",
} as const;

export type MediaUsageRestriction =
  (typeof MEDIA_USAGE_RESTRICTION)[keyof typeof MEDIA_USAGE_RESTRICTION];

export const MEDIA_USAGE_RESTRICTIONS = [
  MEDIA_USAGE_RESTRICTION.NONE,
  MEDIA_USAGE_RESTRICTION.EDITORIAL_ONLY,
  MEDIA_USAGE_RESTRICTION.RESTRICTED,
] as const;

export const MEDIA_RIGHTS_STATUS = {
  INCOMPLETE: "INCOMPLETE",
  RESTRICTED: "RESTRICTED",
  EXPIRED: "EXPIRED",
  NOT_STARTED: "NOT_STARTED",
  CLEARED: "CLEARED",
} as const;

export type MediaRightsStatus =
  (typeof MEDIA_RIGHTS_STATUS)[keyof typeof MEDIA_RIGHTS_STATUS];

export const MEDIA_PUBLIC_INELIGIBILITY_REASON = {
  RIGHTS_INCOMPLETE: "RIGHTS_INCOMPLETE",
  LICENSE_NOT_STARTED: "LICENSE_NOT_STARTED",
  LICENSE_EXPIRED: "LICENSE_EXPIRED",
  USAGE_RESTRICTED: "USAGE_RESTRICTED",
} as const;

export type MediaPublicIneligibilityReason =
  (typeof MEDIA_PUBLIC_INELIGIBILITY_REASON)[keyof typeof MEDIA_PUBLIC_INELIGIBILITY_REASON];

export const MEDIA_RIGHTS_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  MEDIA_NOT_FOUND: "MEDIA_NOT_FOUND",
  INVALID_RIGHTS: "INVALID_RIGHTS",
} as const;

export type MediaRightsErrorCode =
  (typeof MEDIA_RIGHTS_ERROR)[keyof typeof MEDIA_RIGHTS_ERROR];

export class MediaRightsError extends Error {
  readonly code: MediaRightsErrorCode;

  constructor(code: MediaRightsErrorCode, message: string = code) {
    super(message);
    this.name = "MediaRightsError";
    this.code = code;
  }
}

export type MediaRightsDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: MediaRightsErrorCode };

export const MEDIA_RIGHTS_TEXT_MAX = {
  NAME: 200,
  CREDIT: 200,
  REFERENCE: 200,
  TERRITORY: 200,
  NOTE: 4000,
} as const;

export type MediaRightsRecord = {
  sourceKind: MediaSourceKind;
  sourceName: string | null;
  creatorName: string | null;
  rightsHolder: string | null;
  licenseType: MediaLicenseType;
  licenseReference: string | null;
  licenseNote: string | null;
  licenseStartsAt: Date | string | null;
  licenseExpiresAt: Date | string | null;
  creditLine: string | null;
  usageRestriction: MediaUsageRestriction;
  territoryRestriction: string | null;
};

export type CanonicalMediaRights = {
  sourceKind: MediaSourceKind;
  sourceName: string | null;
  creatorName: string | null;
  rightsHolder: string | null;
  licenseType: MediaLicenseType;
  licenseReference: string | null;
  licenseNote: string | null;
  licenseStartsAt: Date | null;
  licenseExpiresAt: Date | null;
  creditLine: string | null;
  usageRestriction: MediaUsageRestriction;
  territoryRestriction: string | null;
};

export type MediaRightsWriteInput = {
  sourceKind: string;
  sourceName?: string | null;
  creatorName?: string | null;
  rightsHolder?: string | null;
  licenseType: string;
  licenseReference?: string | null;
  licenseNote?: string | null;
  licenseStartsAt?: Date | string | null;
  licenseExpiresAt?: Date | string | null;
  creditLine?: string | null;
  usageRestriction: string;
  territoryRestriction?: string | null;
};

export type MediaPublicEligibility = {
  eligible: boolean;
  status: MediaRightsStatus;
  reasons: MediaPublicIneligibilityReason[];
};

export type PublicMediaProjection = {
  url: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  credit: string | null;
};

/** Defaults matching additive migration for existing media rows. */
export function defaultMediaRights(): CanonicalMediaRights {
  return {
    sourceKind: MEDIA_SOURCE_KIND.UNKNOWN,
    sourceName: null,
    creatorName: null,
    rightsHolder: null,
    licenseType: MEDIA_LICENSE_TYPE.UNKNOWN,
    licenseReference: null,
    licenseNote: null,
    licenseStartsAt: null,
    licenseExpiresAt: null,
    creditLine: null,
    usageRestriction: MEDIA_USAGE_RESTRICTION.NONE,
    territoryRestriction: null,
  };
}

export function authorizeMediaRightsRead(input: {
  roles: readonly StaffRole[];
}): MediaRightsDecision<true> {
  if (!hasCapability(input.roles, CAPABILITY.CONTENT_READ)) {
    return { ok: false, code: MEDIA_RIGHTS_ERROR.FORBIDDEN };
  }
  return { ok: true, value: true };
}

export function authorizeMediaRightsWrite(input: {
  roles: readonly StaffRole[];
}): MediaRightsDecision<true> {
  if (!hasCapability(input.roles, CAPABILITY.CONTENT_EDIT)) {
    return { ok: false, code: MEDIA_RIGHTS_ERROR.FORBIDDEN };
  }
  return { ok: true, value: true };
}

function isSourceKind(value: string): value is MediaSourceKind {
  return (MEDIA_SOURCE_KINDS as readonly string[]).includes(value);
}

function isLicenseType(value: string): value is MediaLicenseType {
  return (MEDIA_LICENSE_TYPES as readonly string[]).includes(value);
}

function isUsageRestriction(value: string): value is MediaUsageRestriction {
  return (MEDIA_USAGE_RESTRICTIONS as readonly string[]).includes(value);
}

function canonicalizeBoundedText(
  raw: string | null | undefined,
  max: number,
): MediaRightsDecision<string | null> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: true, value: null };
  }
  if (trimmed.length > max) {
    return { ok: false, code: MEDIA_RIGHTS_ERROR.INVALID_RIGHTS };
  }
  return { ok: true, value: trimmed };
}

function canonicalizeInstant(
  raw: Date | string | null | undefined,
): MediaRightsDecision<Date | null> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw === "string" && raw.trim().length === 0) {
    return { ok: true, value: null };
  }
  const value = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(value.getTime())) {
    return { ok: false, code: MEDIA_RIGHTS_ERROR.INVALID_RIGHTS };
  }
  return { ok: true, value: value };
}

export function canonicalizeMediaRightsWrite(
  input: MediaRightsWriteInput,
): MediaRightsDecision<CanonicalMediaRights> {
  if (!isSourceKind(input.sourceKind) || !isLicenseType(input.licenseType)) {
    return { ok: false, code: MEDIA_RIGHTS_ERROR.INVALID_RIGHTS };
  }
  if (!isUsageRestriction(input.usageRestriction)) {
    return { ok: false, code: MEDIA_RIGHTS_ERROR.INVALID_RIGHTS };
  }

  const sourceName = canonicalizeBoundedText(
    input.sourceName,
    MEDIA_RIGHTS_TEXT_MAX.NAME,
  );
  const creatorName = canonicalizeBoundedText(
    input.creatorName,
    MEDIA_RIGHTS_TEXT_MAX.NAME,
  );
  const rightsHolder = canonicalizeBoundedText(
    input.rightsHolder,
    MEDIA_RIGHTS_TEXT_MAX.NAME,
  );
  const licenseReference = canonicalizeBoundedText(
    input.licenseReference,
    MEDIA_RIGHTS_TEXT_MAX.REFERENCE,
  );
  const licenseNote = canonicalizeBoundedText(
    input.licenseNote,
    MEDIA_RIGHTS_TEXT_MAX.NOTE,
  );
  const creditLine = canonicalizeBoundedText(
    input.creditLine,
    MEDIA_RIGHTS_TEXT_MAX.CREDIT,
  );
  const territoryRestriction = canonicalizeBoundedText(
    input.territoryRestriction,
    MEDIA_RIGHTS_TEXT_MAX.TERRITORY,
  );
  const licenseStartsAt = canonicalizeInstant(input.licenseStartsAt);
  const licenseExpiresAt = canonicalizeInstant(input.licenseExpiresAt);

  if (
    !sourceName.ok ||
    !creatorName.ok ||
    !rightsHolder.ok ||
    !licenseReference.ok ||
    !licenseNote.ok ||
    !creditLine.ok ||
    !territoryRestriction.ok ||
    !licenseStartsAt.ok ||
    !licenseExpiresAt.ok
  ) {
    return { ok: false, code: MEDIA_RIGHTS_ERROR.INVALID_RIGHTS };
  }

  if (
    licenseStartsAt.value !== null &&
    licenseExpiresAt.value !== null &&
    licenseExpiresAt.value.getTime() <= licenseStartsAt.value.getTime()
  ) {
    return { ok: false, code: MEDIA_RIGHTS_ERROR.INVALID_RIGHTS };
  }

  return {
    ok: true,
    value: {
      sourceKind: input.sourceKind,
      sourceName: sourceName.value,
      creatorName: creatorName.value,
      rightsHolder: rightsHolder.value,
      licenseType: input.licenseType,
      licenseReference: licenseReference.value,
      licenseNote: licenseNote.value,
      licenseStartsAt: licenseStartsAt.value,
      licenseExpiresAt: licenseExpiresAt.value,
      creditLine: creditLine.value,
      usageRestriction: input.usageRestriction,
      territoryRestriction: territoryRestriction.value,
    },
  };
}

function instantMs(value: Date | string | null): number | null {
  if (value === null) {
    return null;
  }
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function deriveStatus(
  reasons: readonly MediaPublicIneligibilityReason[],
): MediaRightsStatus {
  if (reasons.includes(MEDIA_PUBLIC_INELIGIBILITY_REASON.USAGE_RESTRICTED)) {
    return MEDIA_RIGHTS_STATUS.RESTRICTED;
  }
  if (reasons.includes(MEDIA_PUBLIC_INELIGIBILITY_REASON.LICENSE_EXPIRED)) {
    return MEDIA_RIGHTS_STATUS.EXPIRED;
  }
  if (reasons.includes(MEDIA_PUBLIC_INELIGIBILITY_REASON.LICENSE_NOT_STARTED)) {
    return MEDIA_RIGHTS_STATUS.NOT_STARTED;
  }
  if (reasons.includes(MEDIA_PUBLIC_INELIGIBILITY_REASON.RIGHTS_INCOMPLETE)) {
    return MEDIA_RIGHTS_STATUS.INCOMPLETE;
  }
  return MEDIA_RIGHTS_STATUS.CLEARED;
}

/**
 * Deterministic public-use eligibility. `now` must be an explicit instant;
 * callers must not rely on implicit local timezone conversion.
 */
export function evaluateMediaPublicEligibility(
  rights: MediaRightsRecord,
  now: Date,
): MediaPublicEligibility {
  const nowMs = now.getTime();
  const reasons: MediaPublicIneligibilityReason[] = [];

  const incomplete =
    rights.sourceKind === MEDIA_SOURCE_KIND.UNKNOWN ||
    rights.licenseType === MEDIA_LICENSE_TYPE.UNKNOWN ||
    rights.rightsHolder === null ||
    rights.rightsHolder.trim().length === 0 ||
    rights.creditLine === null ||
    rights.creditLine.trim().length === 0;
  if (incomplete) {
    reasons.push(MEDIA_PUBLIC_INELIGIBILITY_REASON.RIGHTS_INCOMPLETE);
  }

  if (rights.usageRestriction === MEDIA_USAGE_RESTRICTION.RESTRICTED) {
    reasons.push(MEDIA_PUBLIC_INELIGIBILITY_REASON.USAGE_RESTRICTED);
  }

  const startsAtMs = instantMs(rights.licenseStartsAt);
  if (startsAtMs !== null && startsAtMs > nowMs) {
    reasons.push(MEDIA_PUBLIC_INELIGIBILITY_REASON.LICENSE_NOT_STARTED);
  }

  const expiresAtMs = instantMs(rights.licenseExpiresAt);
  if (expiresAtMs !== null && expiresAtMs <= nowMs) {
    reasons.push(MEDIA_PUBLIC_INELIGIBILITY_REASON.LICENSE_EXPIRED);
  }

  return {
    eligible: reasons.length === 0,
    status: deriveStatus(reasons),
    reasons,
  };
}

export function toPublicMediaProjection(input: {
  publicUrl: string | null;
  width: number | null;
  height: number | null;
  altText: string | null;
  attachmentCredit: string | null;
  creditLine: string | null;
}): PublicMediaProjection {
  const attachmentCredit = input.attachmentCredit?.trim() || null;
  const creditLine = input.creditLine?.trim() || null;
  return {
    url: input.publicUrl,
    width: input.width,
    height: input.height,
    altText: input.altText,
    credit: attachmentCredit ?? creditLine,
  };
}
