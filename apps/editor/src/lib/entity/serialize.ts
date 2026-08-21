import type {
  EditorEntityAuditItem,
  EditorEntityDetail,
  EditorEntityListItem,
  EditorEntityPickerItem,
  EditorEntitySlugHistoryItem,
} from "@magazine/db/entities";
import type { EditorEntityDuplicateItem } from "@magazine/db/entities";

function serializeDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export type EntityListHttpDto = {
  entityId: string;
  kind: EditorEntityListItem["kind"];
  status: EditorEntityListItem["status"];
  canonicalName: string;
  slug: string;
  summary: string | null;
  portraitMediaId: string | null;
  updatedAt: string;
};

export type EntityDetailHttpDto = {
  entityId: string;
  kind: EditorEntityDetail["kind"];
  status: EditorEntityDetail["status"];
  canonicalName: string;
  slug: string;
  summary: string | null;
  biography: string | null;
  portraitMediaId: string | null;
  birthDate: string | null;
  occupation: string | null;
  officialWebsiteUrl: string | null;
  aliases: { aliasId: string; display: string }[];
  updatedAt: string;
};

export type EntityPickerHttpDto = {
  id: string;
  canonicalName: string;
  kind: EditorEntityPickerItem["kind"];
  status: EditorEntityPickerItem["status"];
  portraitMediaId: string | null;
};

export type EntityDuplicateHttpDto = {
  entityId: string;
  canonicalName: string;
  kind: string;
  status: string;
  matchedOn: string;
};

export type EntitySlugHistoryHttpDto = {
  oldSlug: string;
  changedAt: string;
};

export type EntityAuditHttpDto = {
  eventType: string;
  occurredAt: string;
  changeSummary: string | null;
};

const FORBIDDEN_SERIALIZED_KEYS = [
  "storageKey",
  "internalNote",
  "changeSet",
  "mergedIntoEntityId",
  "deletedAt",
] as const;

export function assertSafeEntityHttpPayload(value: unknown): void {
  const stack: unknown[] = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === null || typeof current !== "object") {
      continue;
    }
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    for (const [key, nested] of Object.entries(current)) {
      if (
        FORBIDDEN_SERIALIZED_KEYS.some(
          (forbidden) => key.toLowerCase().includes(forbidden.toLowerCase()),
        )
      ) {
        throw new Error(`Unsafe entity HTTP payload key: ${key}`);
      }
      stack.push(nested);
    }
  }
}

export function serializeEntityListItem(
  item: EditorEntityListItem,
): EntityListHttpDto {
  return {
    entityId: item.entityId,
    kind: item.kind,
    status: item.status,
    canonicalName: item.canonicalName,
    slug: item.slug,
    summary: item.summary,
    portraitMediaId: item.portraitMediaId,
    updatedAt: serializeDate(item.updatedAt),
  };
}

export function serializeEntityDetail(item: EditorEntityDetail): EntityDetailHttpDto {
  return {
    entityId: item.entityId,
    kind: item.kind,
    status: item.status,
    canonicalName: item.canonicalName,
    slug: item.slug,
    summary: item.summary,
    biography: item.biography,
    portraitMediaId: item.portraitMediaId,
    birthDate: item.birthDate,
    occupation: item.occupation,
    officialWebsiteUrl: item.officialWebsiteUrl,
    aliases: item.aliases.map((alias) => ({
      aliasId: alias.aliasId,
      display: alias.display,
    })),
    updatedAt: serializeDate(item.updatedAt),
  };
}

export function serializeEntityPickerItem(
  item: EditorEntityPickerItem,
): EntityPickerHttpDto {
  return {
    id: item.id,
    canonicalName: item.canonicalName,
    kind: item.kind,
    status: item.status,
    portraitMediaId: item.portraitMediaId,
  };
}

export function serializeEntityDuplicate(
  signal: EditorEntityDuplicateItem,
): EntityDuplicateHttpDto {
  return {
    entityId: signal.entityId,
    canonicalName: signal.canonicalName,
    kind: signal.kind,
    status: signal.status,
    matchedOn: signal.matchedOn,
  };
}

export function serializeEntitySlugHistoryItem(
  item: EditorEntitySlugHistoryItem,
): EntitySlugHistoryHttpDto {
  return {
    oldSlug: item.oldSlug,
    changedAt: serializeDate(item.changedAt),
  };
}

export function serializeEntityAuditItem(
  item: EditorEntityAuditItem,
): EntityAuditHttpDto {
  return {
    eventType: item.eventType,
    occurredAt: serializeDate(item.occurredAt),
    changeSummary: item.changeSummary,
  };
}
