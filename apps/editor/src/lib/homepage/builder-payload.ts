import {
  assertHomepageSlotKey,
  CONVERSATION_LABEL_MAX_LENGTH,
  CONVERSATION_REASON_MAX_LENGTH,
  isUuid,
  resolveHomepageFeaturedNeighborMove,
  type HomepageFeaturedMoveDirection,
  type HomepageSlotKey,
} from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";

function assertRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return body as Record<string, unknown>;
}

function parseExpectedUpdatedAt(record: Record<string, unknown>): string {
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
  return expectedUpdatedAt;
}

function parseOptionalContentItemId(record: Record<string, unknown>): string | null {
  if (record.contentItemId === undefined || record.contentItemId === null) {
    return null;
  }
  if (typeof record.contentItemId !== "string" || !isUuid(record.contentItemId)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return record.contentItemId;
}

function parseConversationLabel(record: Record<string, unknown>): string {
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (label.length === 0 || label.length > CONVERSATION_LABEL_MAX_LENGTH) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return label;
}

function parseConversationReason(record: Record<string, unknown>): string | null {
  if (record.reason === undefined || record.reason === null) {
    return null;
  }
  if (typeof record.reason !== "string") {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  const reason = record.reason.trim();
  if (reason.length === 0) {
    return null;
  }
  if (reason.length > CONVERSATION_REASON_MAX_LENGTH) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return reason;
}

function parseConversationItemId(record: Record<string, unknown>): string {
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!isUuid(id)) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return id;
}

export function parseSetHomepageSlotBody(body: unknown): {
  expectedUpdatedAt: string;
  slotKey: HomepageSlotKey;
  contentItemId: string | null;
} {
  const record = assertRecord(body);
  const expectedUpdatedAt = parseExpectedUpdatedAt(record);

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
  const record = assertRecord(body);
  const expectedUpdatedAt = parseExpectedUpdatedAt(record);

  return { expectedUpdatedAt };
}

export function parseSetHomepageVideoBody(body: unknown): {
  expectedUpdatedAt: string;
  videoAssetId: string | null;
} {
  const record = assertRecord(body);
  const expectedUpdatedAt = parseExpectedUpdatedAt(record);

  let videoAssetId: string | null = null;
  if (record.videoAssetId !== undefined && record.videoAssetId !== null) {
    if (typeof record.videoAssetId !== "string" || !isUuid(record.videoAssetId)) {
      throw new EditorHttpError(
        400,
        EDITOR_API_ERROR.INVALID_REQUEST,
        "The request is invalid.",
      );
    }
    videoAssetId = record.videoAssetId;
  }

  return { expectedUpdatedAt, videoAssetId };
}

export function parseMoveHomepageFeaturedBody(body: unknown): {
  expectedUpdatedAt: string;
  slotKey: HomepageSlotKey;
  direction: HomepageFeaturedMoveDirection;
} {
  const record = assertRecord(body);
  const expectedUpdatedAt = parseExpectedUpdatedAt(record);

  const slotKeyRaw =
    typeof record.slotKey === "string" ? record.slotKey.trim() : "";
  const directionRaw =
    typeof record.direction === "string" ? record.direction.trim() : "";
  const moveDecision = resolveHomepageFeaturedNeighborMove({
    slotKey: slotKeyRaw,
    direction: directionRaw,
  });
  if (!moveDecision.ok) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  return {
    expectedUpdatedAt,
    slotKey: moveDecision.value.from,
    direction: directionRaw === "left" ? "left" : "right",
  };
}

export function parseCreateHomepageConversationBody(body: unknown): {
  label: string;
  reason: string | null;
  contentItemId: string | null;
  isActive: boolean;
} {
  const record = assertRecord(body);
  return {
    label: parseConversationLabel(record),
    reason: parseConversationReason(record),
    contentItemId: parseOptionalContentItemId(record),
    isActive: record.isActive === undefined ? true : record.isActive === true,
  };
}

export function parseUpdateHomepageConversationBody(body: unknown): {
  id: string;
  expectedUpdatedAt: string;
  label: string;
  reason: string | null;
  contentItemId: string | null;
  isActive?: boolean;
} {
  const record = assertRecord(body);
  return {
    id: parseConversationItemId(record),
    expectedUpdatedAt: parseExpectedUpdatedAt(record),
    label: parseConversationLabel(record),
    reason: parseConversationReason(record),
    contentItemId: parseOptionalContentItemId(record),
    isActive:
      record.isActive === undefined ? undefined : record.isActive === true,
  };
}

export function parseDeleteHomepageConversationBody(body: unknown): {
  id: string;
  expectedUpdatedAt: string;
} {
  const record = assertRecord(body);
  return {
    id: parseConversationItemId(record),
    expectedUpdatedAt: parseExpectedUpdatedAt(record),
  };
}

export function parseReorderHomepageConversationBody(body: unknown): {
  expectedUpdatedAt: string;
  orderedIds: string[];
} {
  const record = assertRecord(body);
  const expectedUpdatedAt = parseExpectedUpdatedAt(record);
  const rawIds = Array.isArray(record.orderedIds) ? record.orderedIds : null;
  if (!rawIds || !rawIds.every((id) => typeof id === "string" && isUuid(id))) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }
  return {
    expectedUpdatedAt,
    orderedIds: rawIds,
  };
}
