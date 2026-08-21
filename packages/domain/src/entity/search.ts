import { ENTITY_ERROR, ENTITY_TEXT_MAX, type EntityDecision } from "./types";

export const ENTITY_SEARCH_LOCALE = "tr";

const WHITESPACE = /\s+/g;

/**
 * Search key is separate from display value. Turkish case folding is used;
 * ASCII transliteration is intentionally not applied.
 */
export function normalizeEntitySearchKey(raw: string): string {
  return raw.normalize("NFC").replace(WHITESPACE, " ").trim().toLocaleLowerCase(
    ENTITY_SEARCH_LOCALE,
  );
}

export function canonicalizeEntitySearchKey(
  raw: string,
  max: number = ENTITY_TEXT_MAX.ALIAS,
): EntityDecision<string> {
  const key = normalizeEntitySearchKey(raw);
  if (key.length < 1 || key.length > max) {
    return { ok: false, code: ENTITY_ERROR.INVALID_ALIAS };
  }
  return { ok: true, value: key };
}

export type EntityDuplicateCandidate = {
  entityId: string;
  canonicalName: string;
  aliases: readonly string[];
};

export type EntityDuplicateSignal =
  | { kind: "CANONICAL_NAME"; entityId: string; searchKey: string }
  | { kind: "ALIAS"; entityId: string; searchKey: string };

/**
 * Advisory exact-match signals only. Never merges entities.
 */
export function collectAdvisoryDuplicateSignals(input: {
  candidateEntityId?: string;
  canonicalName: string;
  aliases?: readonly string[];
  existing: readonly EntityDuplicateCandidate[];
}): EntityDuplicateSignal[] {
  const nameKey = normalizeEntitySearchKey(input.canonicalName);
  const aliasKeys = new Set(
    (input.aliases ?? []).map((alias) => normalizeEntitySearchKey(alias)),
  );
  const signals: EntityDuplicateSignal[] = [];

  for (const existing of input.existing) {
    if (
      input.candidateEntityId !== undefined &&
      existing.entityId === input.candidateEntityId
    ) {
      continue;
    }

    if (normalizeEntitySearchKey(existing.canonicalName) === nameKey) {
      signals.push({
        kind: "CANONICAL_NAME",
        entityId: existing.entityId,
        searchKey: nameKey,
      });
    }

    const existingKeys = new Set([
      normalizeEntitySearchKey(existing.canonicalName),
      ...existing.aliases.map((alias) => normalizeEntitySearchKey(alias)),
    ]);

    for (const aliasKey of aliasKeys) {
      if (aliasKey.length === 0) {
        continue;
      }
      if (existingKeys.has(aliasKey)) {
        signals.push({
          kind: "ALIAS",
          entityId: existing.entityId,
          searchKey: aliasKey,
        });
      }
    }
  }

  return signals;
}

export const ENTITY_DUPLICATE_WARNING =
  "Benzer bir kişi zaten mevcut olabilir." as const;
