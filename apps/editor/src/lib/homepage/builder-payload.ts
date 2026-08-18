import {
  assertHomepageSlotKey,
  isUuid,
  type HomepageSlotKey,
} from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";

export function parseSetHomepageSlotBody(body: unknown): {
  expectedUpdatedAt: string;
  slotKey: HomepageSlotKey;
  contentItemId: string | null;
} {
  if (!body || typeof body !== "object") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const record = body as Record<string, unknown>;
  const expectedUpdatedAt =
    typeof record.expectedUpdatedAt === "string"
      ? record.expectedUpdatedAt.trim()
      : "";
  if (!expectedUpdatedAt) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const slotKeyRaw =
    typeof record.slotKey === "string" ? record.slotKey.trim() : "";
  const slotDecision = assertHomepageSlotKey(slotKeyRaw);
  if (!slotDecision.ok) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  let contentItemId: string | null = null;
  if (record.contentItemId !== undefined && record.contentItemId !== null) {
    if (typeof record.contentItemId !== "string" || !isUuid(record.contentItemId)) {
      throw new EditorHttpError(
        400,
        EDITOR_API_ERROR.INVALID_REQUEST,
        "The request is invalid.",
      );
    }
    contentItemId = record.contentItemId;
  }

  return {
    expectedUpdatedAt,
    slotKey: slotDecision.value,
    contentItemId,
  };
}

export function parsePublishHomepageBody(body: unknown): { expectedUpdatedAt: string } {
  if (!body || typeof body !== "object") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  const record = body as Record<string, unknown>;
  const expectedUpdatedAt =
    typeof record.expectedUpdatedAt === "string"
      ? record.expectedUpdatedAt.trim()
      : "";
  if (!expectedUpdatedAt) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return { expectedUpdatedAt };
}
