import { canonicalizeEntitySlug, PUBLIC_ENTITY_PROFILE_PATH_PREFIX } from "./identity";
import { normalizeEntitySearchKey } from "./search";
import { ENTITY_STATUS, type EntityStatus } from "./types";
import type { EntityKind } from "../entity-kind";

export const ENTITY_LINK_ASSISTANT_BOUNDS = {
  MAX_BODY_CHARS: 20_000,
  MAX_HREFS: 100,
  MAX_CATALOGUE: 5_000,
  MAX_SUGGESTIONS: 12,
  MAX_AMBIGUOUS_CANDIDATES: 8,
  MAX_STALE_WARNINGS: 5,
  MIN_TOKEN_CHARS: 1,
} as const;

export const ENTITY_LINK_MATCHED_BY = {
  CANONICAL_NAME: "CANONICAL_NAME",
  ALIAS: "ALIAS",
} as const;

export type EntityLinkMatchedBy =
  (typeof ENTITY_LINK_MATCHED_BY)[keyof typeof ENTITY_LINK_MATCHED_BY];

export const ENTITY_LINK_SUGGESTION_KIND = {
  MATCH: "MATCH",
  AMBIGUOUS: "AMBIGUOUS",
} as const;

export type EntityLinkCatalogueLabel = {
  display: string;
  searchKey: string;
  matchedBy: EntityLinkMatchedBy;
};

export type EntityLinkCatalogueEntry = {
  entityId: string;
  canonicalName: string;
  slug: string;
  kind: EntityKind;
  status: EntityStatus;
  labels: readonly EntityLinkCatalogueLabel[];
};

export type EntityLinkSuggestionCandidate = {
  entityId: string;
  canonicalName: string;
  slug: string;
  kind: EntityKind;
  status: EntityStatus;
  publicProfileEligible: boolean;
};

export type EntityLinkMatchSuggestion = {
  kind: typeof ENTITY_LINK_SUGGESTION_KIND.MATCH;
  matchedText: string;
  matchedBy: EntityLinkMatchedBy;
  alreadyRelated: boolean;
  alreadyLinked: boolean;
  entity: EntityLinkSuggestionCandidate;
};

export type EntityLinkAmbiguousSuggestion = {
  kind: typeof ENTITY_LINK_SUGGESTION_KIND.AMBIGUOUS;
  matchedText: string;
  matchedBy: EntityLinkMatchedBy;
  message: typeof ENTITY_LINK_AMBIGUITY_MESSAGE;
  candidates: EntityLinkSuggestionCandidate[];
};

export type EntityLinkSuggestion =
  | EntityLinkMatchSuggestion
  | EntityLinkAmbiguousSuggestion;

export type EntityStaleSlugWarning = {
  kind: "STALE_SLUG";
  requestedSlug: string;
  currentSlug: string;
  canonicalName: string;
  entityId: string;
};

export const ENTITY_LINK_AMBIGUITY_MESSAGE =
  "Bu ifade birden fazla varlıkla eşleşiyor." as const;

export type ArticleEntityLinkInspection = {
  text: string;
  hrefs: string[];
  truncated: boolean;
};

type TextToken = {
  raw: string;
  key: string;
  index: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pushText(parts: string[], value: string, remaining: { chars: number }): void {
  if (remaining.chars <= 0 || value.length === 0) {
    return;
  }
  const slice = value.slice(0, remaining.chars);
  parts.push(slice);
  remaining.chars -= slice.length;
}

function walkBodyText(value: unknown, parts: string[], remaining: { chars: number }): void {
  if (remaining.chars <= 0) {
    return;
  }
  if (typeof value === "string") {
    pushText(parts, value, remaining);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkBodyText(item, parts, remaining);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  if (typeof value.text === "string") {
    pushText(parts, value.text, remaining);
    if (remaining.chars > 0) {
      pushText(parts, " ", remaining);
    }
    return;
  }
  if (value.content !== undefined) {
    walkBodyText(value.content, parts, remaining);
    return;
  }
  if (Array.isArray(value.blocks)) {
    walkBodyText(value.blocks, parts, remaining);
  }
}

function walkBodyHrefs(value: unknown, hrefs: string[], remaining: { count: number }): void {
  if (remaining.count <= 0) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      walkBodyHrefs(item, hrefs, remaining);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  if (typeof value.href === "string" && value.href.length > 0) {
    hrefs.push(value.href);
    remaining.count -= 1;
  }
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") {
      walkBodyHrefs(nested, hrefs, remaining);
    }
  }
}

export function inspectArticleTextForEntityLinks(input: {
  body: unknown;
  title?: string | null;
}): ArticleEntityLinkInspection {
  const remaining = { chars: ENTITY_LINK_ASSISTANT_BOUNDS.MAX_BODY_CHARS };
  const parts: string[] = [];
  if (typeof input.title === "string" && input.title.trim().length > 0) {
    pushText(parts, input.title.trim(), remaining);
    pushText(parts, "\n", remaining);
  }
  walkBodyText(input.body, parts, remaining);
  const hrefRemaining = { count: ENTITY_LINK_ASSISTANT_BOUNDS.MAX_HREFS };
  const hrefs: string[] = [];
  walkBodyHrefs(input.body, hrefs, hrefRemaining);
  return {
    text: parts.join(""),
    hrefs,
    truncated: remaining.chars <= 0 || hrefRemaining.count <= 0,
  };
}

export function tokenizeEntityLinkText(raw: string): TextToken[] {
  const tokens: TextToken[] = [];
  const value = raw.normalize("NFC");
  const tokenRe = /\p{L}[\p{L}\p{M}'’-]*/gu;
  let match: RegExpExecArray | null = tokenRe.exec(value);
  let index = 0;
  while (match) {
    const rawToken = match[0];
    const key = normalizeEntitySearchKey(rawToken);
    if (key.length >= ENTITY_LINK_ASSISTANT_BOUNDS.MIN_TOKEN_CHARS) {
      tokens.push({ raw: rawToken, key, index });
      index += 1;
    }
    match = tokenRe.exec(value);
  }
  return tokens;
}

export function parsePublicEntityProfileSlug(rawHref: string): string | null {
  const trimmed = rawHref.trim();
  if (trimmed.length === 0 || trimmed.includes("..")) {
    return null;
  }

  let pathname: string;
  try {
    if (trimmed.startsWith("/") || trimmed.startsWith("./")) {
      pathname = new URL(trimmed, "https://magazine.invalid").pathname;
    } else {
      pathname = new URL(trimmed).pathname;
    }
  } catch {
    return null;
  }

  const prefix = PUBLIC_ENTITY_PROFILE_PATH_PREFIX;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) {
    return null;
  }

  const rest = pathname.slice(prefix.length).replace(/^\/+/, "");
  if (rest.length === 0 || rest.includes("/")) {
    return null;
  }

  const slug = canonicalizeEntitySlug(decodeURIComponent(rest));
  return slug.ok ? slug.value : null;
}

function toCandidate(entry: EntityLinkCatalogueEntry): EntityLinkSuggestionCandidate {
  return {
    entityId: entry.entityId,
    canonicalName: entry.canonicalName,
    slug: entry.slug,
    kind: entry.kind,
    status: entry.status,
    publicProfileEligible: entry.status === ENTITY_STATUS.ACTIVE,
  };
}

function labelTokenCount(searchKey: string): number {
  return tokenizeEntityLinkText(searchKey).length;
}

export function matchEntityLinkSuggestions(input: {
  text: string;
  hrefs?: readonly string[];
  catalogue: readonly EntityLinkCatalogueEntry[];
  relatedEntityIds?: readonly string[];
}): EntityLinkSuggestion[] {
  const related = new Set(input.relatedEntityIds ?? []);
  const linkedSlugs = new Set(
    (input.hrefs ?? [])
      .map((href) => parsePublicEntityProfileSlug(href))
      .filter((slug): slug is string => slug !== null),
  );

  const bySearchKey = new Map<string, EntityLinkCatalogueEntry[]>();
  const labels: {
    searchKey: string;
    tokenCount: number;
    matchedBy: EntityLinkMatchedBy;
  }[] = [];

  for (const entry of input.catalogue) {
    if (entry.status !== ENTITY_STATUS.ACTIVE) {
      continue;
    }
    for (const label of entry.labels) {
      const key = normalizeEntitySearchKey(label.searchKey);
      if (key.length < ENTITY_LINK_ASSISTANT_BOUNDS.MIN_TOKEN_CHARS) {
        continue;
      }
      const owners = bySearchKey.get(key) ?? [];
      if (!owners.some((item) => item.entityId === entry.entityId)) {
        owners.push(entry);
        bySearchKey.set(key, owners);
      }
      const existing = labels.find((item) => item.searchKey === key);
      if (!existing) {
        labels.push({
          searchKey: key,
          tokenCount: labelTokenCount(key),
          matchedBy: label.matchedBy,
        });
      } else if (
        existing.matchedBy !== ENTITY_LINK_MATCHED_BY.CANONICAL_NAME &&
        label.matchedBy === ENTITY_LINK_MATCHED_BY.CANONICAL_NAME
      ) {
        existing.matchedBy = ENTITY_LINK_MATCHED_BY.CANONICAL_NAME;
      }
    }
  }

  labels.sort((left, right) => {
    if (right.tokenCount !== left.tokenCount) {
      return right.tokenCount - left.tokenCount;
    }
    return right.searchKey.length - left.searchKey.length;
  });

  const tokens = tokenizeEntityLinkText(input.text);
  const consumed = new Array(tokens.length).fill(false);
  const matches: EntityLinkSuggestion[] = [];
  const seenEntity = new Set<string>();
  const seenAmbiguousKey = new Set<string>();

  for (const label of labels) {
    const labelTokens = tokenizeEntityLinkText(label.searchKey);
    if (labelTokens.length === 0) {
      continue;
    }
    for (let start = 0; start <= tokens.length - labelTokens.length; start += 1) {
      if (consumed[start]) {
        continue;
      }
      let matched = true;
      for (let offset = 0; offset < labelTokens.length; offset += 1) {
        if (
          consumed[start + offset] ||
          tokens[start + offset]?.key !== labelTokens[offset]?.key
        ) {
          matched = false;
          break;
        }
      }
      if (!matched) {
        continue;
      }

      const owners = bySearchKey.get(label.searchKey) ?? [];
      const matchedText = tokens
        .slice(start, start + labelTokens.length)
        .map((token) => token.raw)
        .join(" ");

      for (let offset = 0; offset < labelTokens.length; offset += 1) {
        consumed[start + offset] = true;
      }

      if (owners.length > 1) {
        if (!seenAmbiguousKey.has(label.searchKey)) {
          seenAmbiguousKey.add(label.searchKey);
          matches.push({
            kind: ENTITY_LINK_SUGGESTION_KIND.AMBIGUOUS,
            matchedText,
            matchedBy: label.matchedBy,
            message: ENTITY_LINK_AMBIGUITY_MESSAGE,
            candidates: owners
              .slice(0, ENTITY_LINK_ASSISTANT_BOUNDS.MAX_AMBIGUOUS_CANDIDATES)
              .map(toCandidate),
          });
        }
        break;
      }

      const entity = owners[0];
      if (!entity || seenEntity.has(entity.entityId)) {
        break;
      }
      seenEntity.add(entity.entityId);
      matches.push({
        kind: ENTITY_LINK_SUGGESTION_KIND.MATCH,
        matchedText,
        matchedBy: label.matchedBy,
        alreadyRelated: related.has(entity.entityId),
        alreadyLinked: linkedSlugs.has(entity.slug),
        entity: toCandidate(entity),
      });
      break;
    }
  }

  const addable = matches.filter(
    (item) => item.kind === ENTITY_LINK_SUGGESTION_KIND.MATCH && !item.alreadyRelated,
  );
  const ambiguous = matches.filter(
    (item) => item.kind === ENTITY_LINK_SUGGESTION_KIND.AMBIGUOUS,
  );
  const relatedMatches = matches.filter(
    (item) => item.kind === ENTITY_LINK_SUGGESTION_KIND.MATCH && item.alreadyRelated,
  );

  return [...addable, ...ambiguous, ...relatedMatches].slice(
    0,
    ENTITY_LINK_ASSISTANT_BOUNDS.MAX_SUGGESTIONS,
  );
}

export function collectStaleEntitySlugWarnings(input: {
  hrefs: readonly string[];
  currentByOldSlug: ReadonlyMap<
    string,
    {
      entityId: string;
      currentSlug: string;
      canonicalName: string;
      publicEligible: boolean;
    }
  >;
}): EntityStaleSlugWarning[] {
  const warnings: EntityStaleSlugWarning[] = [];
  const seen = new Set<string>();

  for (const href of input.hrefs) {
    const requested = parsePublicEntityProfileSlug(href);
    if (!requested) {
      continue;
    }
    const current = input.currentByOldSlug.get(requested);
    if (!current || !current.publicEligible || current.currentSlug === requested) {
      continue;
    }
    if (seen.has(requested)) {
      continue;
    }
    seen.add(requested);
    warnings.push({
      kind: "STALE_SLUG",
      requestedSlug: requested,
      currentSlug: current.currentSlug,
      canonicalName: current.canonicalName,
      entityId: current.entityId,
    });
    if (warnings.length >= ENTITY_LINK_ASSISTANT_BOUNDS.MAX_STALE_WARNINGS) {
      break;
    }
  }

  return warnings;
}

export function clampEntityLinkCatalogue<T>(rows: readonly T[]): {
  items: T[];
  truncated: boolean;
} {
  if (rows.length <= ENTITY_LINK_ASSISTANT_BOUNDS.MAX_CATALOGUE) {
    return { items: [...rows], truncated: false };
  }
  return {
    items: rows.slice(0, ENTITY_LINK_ASSISTANT_BOUNDS.MAX_CATALOGUE),
    truncated: true,
  };
}
