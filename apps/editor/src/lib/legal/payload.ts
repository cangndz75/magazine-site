import {
  CONTENT_LEGAL_ACTION_TYPES,
  CONTENT_LEGAL_REASON_CATEGORIES,
  isUuid,
} from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value;
}

export type ParsedRecordLegalActionBody = {
  actionType: string;
  polarity?: string;
  reasonCategory: string;
  internalNote: string;
  publicNote?: string | null;
  effectiveAt?: string | null;
  expectedUpdatedAt: string;
};

export function parseRecordLegalActionBody(body: unknown): ParsedRecordLegalActionBody {
  const record = asRecord(body);
  const actionType = requiredString(record, "actionType");
  if (!(CONTENT_LEGAL_ACTION_TYPES as readonly string[]).includes(actionType)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const reasonCategory = requiredString(record, "reasonCategory");
  if (!(CONTENT_LEGAL_REASON_CATEGORIES as readonly string[]).includes(reasonCategory)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const expectedUpdatedAt = requiredString(record, "expectedUpdatedAt");
  const polarity =
    record.polarity === undefined ? undefined : requiredString(record, "polarity");

  return {
    actionType,
    polarity,
    reasonCategory,
    internalNote: requiredString(record, "internalNote"),
    publicNote: optionalString(record, "publicNote"),
    effectiveAt: optionalString(record, "effectiveAt"),
    expectedUpdatedAt,
  };
}

export type LegalDashboardQuery = {
  actionType?: string;
  search?: string;
  activeHoldOnly?: boolean;
  actorStaffUserId?: string;
  effectiveAfter?: string;
  effectiveBefore?: string;
  limit: number;
  cursor: string | null;
};

export function parseLegalDashboardQuery(
  searchParams: URLSearchParams,
): LegalDashboardQuery {
  const actionType = searchParams.get("actionType")?.trim() || undefined;
  if (
    actionType &&
    !(CONTENT_LEGAL_ACTION_TYPES as readonly string[]).includes(actionType)
  ) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const actorStaffUserId = searchParams.get("actor")?.trim() || undefined;
  if (actorStaffUserId && !isUuid(actorStaffUserId)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const limitRaw = Number(searchParams.get("limit") ?? "25");
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : 25;

  return {
    actionType,
    search: searchParams.get("search")?.trim() || undefined,
    activeHoldOnly: searchParams.get("activeHold") === "1",
    actorStaffUserId,
    effectiveAfter: searchParams.get("effectiveAfter")?.trim() || undefined,
    effectiveBefore: searchParams.get("effectiveBefore")?.trim() || undefined,
    limit,
    cursor: searchParams.get("cursor")?.trim() || null,
  };
}
