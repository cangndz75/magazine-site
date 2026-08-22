import {
  isFeatureControlKey,
  type FeatureControlKey,
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
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value.trim();
}

function requiredExpectedUpdatedAt(record: Record<string, unknown>): string {
  const expectedUpdatedAt = requiredString(record, "expectedUpdatedAt");
  if (Number.isNaN(new Date(expectedUpdatedAt).getTime())) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return expectedUpdatedAt;
}

export function parseFeatureControlKey(value: string): FeatureControlKey {
  if (!isFeatureControlKey(value)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return value;
}

export function parseFeatureControlUpdateBody(body: unknown): {
  enabled: boolean;
  expectedUpdatedAt: string;
} {
  const record = asRecord(body);
  const enabled = record.enabled;
  if (typeof enabled !== "boolean") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return {
    enabled,
    expectedUpdatedAt: requiredExpectedUpdatedAt(record),
  };
}
