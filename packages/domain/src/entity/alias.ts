import { ENTITY_ALIAS_MAX_COUNT, ENTITY_ERROR, ENTITY_TEXT_MAX, type EntityDecision } from "./types";
import { canonicalizeEntitySearchKey, normalizeEntitySearchKey } from "./search";

export type CanonicalEntityAlias = {
  display: string;
  searchKey: string;
};

export function canonicalizeEntityAlias(raw: string): EntityDecision<CanonicalEntityAlias> {
  const display = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (display.length < 1 || display.length > ENTITY_TEXT_MAX.ALIAS) {
    return { ok: false, code: ENTITY_ERROR.INVALID_ALIAS };
  }

  const searchKey = canonicalizeEntitySearchKey(display, ENTITY_TEXT_MAX.ALIAS);
  if (!searchKey.ok) {
    return searchKey;
  }

  return { ok: true, value: { display, searchKey: searchKey.value } };
}

export function canonicalizeEntityAliasSet(
  rawAliases: readonly string[] | undefined,
): EntityDecision<CanonicalEntityAlias[]> {
  const aliases = rawAliases ?? [];
  if (aliases.length > ENTITY_ALIAS_MAX_COUNT) {
    return { ok: false, code: ENTITY_ERROR.ALIAS_LIMIT };
  }

  const canonical: CanonicalEntityAlias[] = [];
  const seen = new Set<string>();

  for (const raw of aliases) {
    const alias = canonicalizeEntityAlias(raw);
    if (!alias.ok) {
      return alias;
    }
    if (seen.has(alias.value.searchKey)) {
      return { ok: false, code: ENTITY_ERROR.DUPLICATE_ALIAS };
    }
    seen.add(alias.value.searchKey);
    canonical.push(alias.value);
  }

  return { ok: true, value: canonical };
}

export type EntityAliasOccupancy = {
  entityId: string;
  searchKey: string;
};

export type AmbiguousEntityAlias = {
  searchKey: string;
  entityIds: string[];
};

/**
 * A shared alias across entities is detectable ambiguity, not a merge key.
 */
export function collectAmbiguousAliases(
  occupancy: readonly EntityAliasOccupancy[],
): AmbiguousEntityAlias[] {
  const byKey = new Map<string, Set<string>>();

  for (const row of occupancy) {
    const key = normalizeEntitySearchKey(row.searchKey);
    if (key.length === 0) {
      continue;
    }
    const owners = byKey.get(key) ?? new Set<string>();
    owners.add(row.entityId);
    byKey.set(key, owners);
  }

  const ambiguous: AmbiguousEntityAlias[] = [];
  for (const [searchKey, owners] of byKey) {
    if (owners.size > 1) {
      ambiguous.push({
        searchKey,
        entityIds: [...owners].sort((left, right) => left.localeCompare(right)),
      });
    }
  }

  return ambiguous.sort((left, right) => left.searchKey.localeCompare(right.searchKey));
}
