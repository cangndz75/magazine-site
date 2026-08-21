import {
  ENTITY_LINK_ASSISTANT_BOUNDS,
  assertStructuredArticleBody,
  isUuid,
} from "@magazine/domain";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";

const RELATED_ID_MAX = 50;

export type EntityLinkSuggestionRequest = {
  body: unknown;
  title: string | null;
  relatedEntityIds: string[];
};

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

export function parseEntityLinkSuggestionRequest(
  raw: unknown,
): EntityLinkSuggestionRequest {
  const record = asRecord(raw);
  const bodyDecision = assertStructuredArticleBody(record.body);
  if (!bodyDecision.ok) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_REQUEST,
      "The request is invalid.",
    );
  }

  let title: string | null = null;
  if (record.title !== undefined && record.title !== null) {
    if (typeof record.title !== "string") {
      throw new EditorHttpError(
        400,
        EDITOR_API_ERROR.INVALID_REQUEST,
        "The request is invalid.",
      );
    }
    const trimmed = record.title.trim();
    title = trimmed.length > 0 ? trimmed.slice(0, 300) : null;
  }

  const relatedRaw = record.relatedEntityIds;
  const relatedEntityIds: string[] = [];
  if (relatedRaw !== undefined && relatedRaw !== null) {
    if (!Array.isArray(relatedRaw) || relatedRaw.length > RELATED_ID_MAX) {
      throw new EditorHttpError(
        400,
        EDITOR_API_ERROR.INVALID_REQUEST,
        "The request is invalid.",
      );
    }
    for (const value of relatedRaw) {
      if (typeof value !== "string" || !isUuid(value)) {
        throw new EditorHttpError(
          400,
          EDITOR_API_ERROR.INVALID_REQUEST,
          "The request is invalid.",
        );
      }
      if (!relatedEntityIds.includes(value)) {
        relatedEntityIds.push(value);
      }
    }
  }

  return {
    body: bodyDecision.value,
    title,
    relatedEntityIds,
  };
}

export const ENTITY_LINK_ASSISTANT_COPY = {
  TITLE: "İç Bağlantı Önerileri",
  EMPTY: "Metinde tanınan bir varlık adı yok.",
  LOADING: "Öneriler hazırlanıyor…",
  ERROR: "Öneriler yüklenemedi.",
  PROFILE_EXISTS: "Profili mevcut",
  ALREADY_RELATED: "Habere bağlı",
  ALREADY_LINKED: "Metinde bağlantı var",
  ADD: "Varlığı Habere Ekle",
  VIEW_PROFILE: "Profili Gör",
  AMBIGUOUS: "Bu ifade birden fazla varlıkla eşleşiyor.",
  STALE_SLUG: "Bu bağlantının güncel profil adresi değişmiş.",
  TRUNCATED: "Uzun metin sınırlı tarandı.",
  DEFAULT_ROLE_HINT: "Ekleme, varlığı Bahsedilen olarak taslağa bağlar.",
} as const;

export function entityProfileHref(trustedSiteUrl: string, slug: string): string {
  const origin = trustedSiteUrl.replace(/\/+$/, "");
  return `${origin}/kimdir/${encodeURIComponent(slug)}`;
}

export function suggestionAddAriaLabel(canonicalName: string): string {
  return `${canonicalName} varlığını habere ekle`;
}

export function suggestionProfileAriaLabel(canonicalName: string): string {
  return `${canonicalName} profilini gör`;
}

export { ENTITY_LINK_ASSISTANT_BOUNDS };
