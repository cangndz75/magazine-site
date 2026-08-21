"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ENTITY_LINK_SUGGESTION_KIND,
  type EntityLinkSuggestion,
  type EntityStaleSlugWarning,
} from "@magazine/domain";
import { formatEntityKindLabel } from "@/lib/content/lookup-labels";
import { editorDocumentToBody, type BodyEditorDocument } from "@/lib/content/body-editor-state";
import {
  ENTITY_LINK_ASSISTANT_COPY,
  entityProfileHref,
  suggestionAddAriaLabel,
  suggestionProfileAriaLabel,
} from "@/lib/entity/link-suggestions";

type Props = {
  contentItemId: string;
  trustedSiteUrl: string;
  title: string;
  bodyDocument: BodyEditorDocument | null;
  relatedEntityIds: string[];
  disabled: boolean;
  onAdd: (entity: {
    id: string;
    name: string;
    kind: string;
    status: string;
  }) => void;
  onSuggestionStats?: (stats: {
    pendingCount: number;
    ambiguousCount: number;
  }) => void;
};

type SuggestionResponse = {
  ok: boolean;
  data?: {
    suggestions: EntityLinkSuggestion[];
    staleSlugWarnings: EntityStaleSlugWarning[];
    truncated: boolean;
  };
};

export function ArticleEntityLinkAssistant({
  contentItemId,
  trustedSiteUrl,
  title,
  bodyDocument,
  relatedEntityIds,
  disabled,
  onAdd,
  onSuggestionStats,
}: Props) {
  const [, startTransition] = useTransition();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "error" }
    | {
        kind: "ready";
        suggestions: EntityLinkSuggestion[];
        staleSlugWarnings: EntityStaleSlugWarning[];
        truncated: boolean;
      }
  >({ kind: "idle" });

  const relatedKey = useMemo(
    () => [...relatedEntityIds].sort().join(","),
    [relatedEntityIds],
  );

  useEffect(() => {
    if (!bodyDocument || disabled) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        startTransition(() => {
          setState({ kind: "loading" });
        });
        try {
          const response = await fetch(
            `/api/content/${contentItemId}/entity-link-suggestions`,
            {
              method: "POST",
              credentials: "same-origin",
              headers: { "content-type": "application/json", accept: "application/json" },
              body: JSON.stringify({
                body: editorDocumentToBody(bodyDocument),
                title,
                relatedEntityIds,
              }),
              signal: controller.signal,
            },
          );
          const payload = (await response.json()) as SuggestionResponse;
          if (!response.ok || !payload.ok || !payload.data) {
            startTransition(() => {
              setState({ kind: "error" });
            });
            return;
          }
          const data = payload.data;
          startTransition(() => {
            setState({
              kind: "ready",
              suggestions: data.suggestions,
              staleSlugWarnings: data.staleSlugWarnings,
              truncated: data.truncated,
            });
          });
        } catch {
          if (controller.signal.aborted) {
            return;
          }
          startTransition(() => {
            setState({ kind: "error" });
          });
        }
      })();
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [bodyDocument, contentItemId, disabled, relatedKey, startTransition, title, relatedEntityIds]);

  useEffect(() => {
    if (!onSuggestionStats) {
      return;
    }
    if (state.kind !== "ready") {
      onSuggestionStats({ pendingCount: 0, ambiguousCount: 0 });
      return;
    }

    const ambiguousCount = state.suggestions.filter(
      (item) => item.kind === ENTITY_LINK_SUGGESTION_KIND.AMBIGUOUS,
    ).length;
    const pendingCount = state.suggestions.filter(
      (item) =>
        item.kind !== ENTITY_LINK_SUGGESTION_KIND.AMBIGUOUS && !item.alreadyRelated,
    ).length;

    onSuggestionStats({ pendingCount, ambiguousCount });
  }, [onSuggestionStats, state]);

  return (
    <section className="space-y-2" aria-labelledby="entity-link-assistant-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3
            id="entity-link-assistant-heading"
            className="text-sm font-semibold text-zinc-900"
          >
            {ENTITY_LINK_ASSISTANT_COPY.TITLE}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {ENTITY_LINK_ASSISTANT_COPY.DEFAULT_ROLE_HINT}
          </p>
        </div>
        {state.kind === "ready" && state.suggestions.length > 0 ? (
          <p className="text-xs font-medium text-zinc-600">
            İç bağlantı önerileri · {state.suggestions.length}
          </p>
        ) : null}
      </div>

      {state.kind === "loading" ? (
        <p role="status" className="text-sm text-zinc-600">
          {ENTITY_LINK_ASSISTANT_COPY.LOADING}
        </p>
      ) : null}

      {state.kind === "error" ? (
        <p role="status" className="text-sm text-red-800">
          {ENTITY_LINK_ASSISTANT_COPY.ERROR}
        </p>
      ) : null}

      {state.kind === "ready" && state.suggestions.length === 0 ? (
        <p className="text-sm text-zinc-600">{ENTITY_LINK_ASSISTANT_COPY.EMPTY}</p>
      ) : null}

      {state.kind === "ready" && state.truncated ? (
        <p role="status" className="text-xs text-zinc-500">
          {ENTITY_LINK_ASSISTANT_COPY.TRUNCATED}
        </p>
      ) : null}

      {state.kind === "ready" && state.staleSlugWarnings.length > 0 ? (
        <ul className="space-y-1">
          {state.staleSlugWarnings.map((warning) => (
            <li
              key={`${warning.entityId}:${warning.requestedSlug}`}
              role="status"
              className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
            >
              {ENTITY_LINK_ASSISTANT_COPY.STALE_SLUG} {warning.canonicalName} →
              /kimdir/{warning.currentSlug}
            </li>
          ))}
        </ul>
      ) : null}

      {state.kind === "ready" && state.suggestions.length > 0 ? (
        <ul className="space-y-2">
          {state.suggestions.map((suggestion) =>
            suggestion.kind === ENTITY_LINK_SUGGESTION_KIND.AMBIGUOUS ? (
              <li
                key={`ambiguous:${suggestion.matchedText}`}
                className="rounded border border-zinc-200 bg-white p-3"
              >
                <p className="text-sm font-medium text-zinc-900">{suggestion.matchedText}</p>
                <p role="status" className="mt-1 text-xs text-zinc-700">
                  {suggestion.message}
                </p>
                <ul className="mt-2 space-y-2">
                  {suggestion.candidates.map((candidate) => (
                    <li
                      key={candidate.entityId}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center"
                    >
                      <p className="min-w-0 flex-1 text-sm text-zinc-800">
                        {candidate.canonicalName}
                        <span className="text-zinc-500">
                          {" "}
                          · {formatEntityKindLabel(candidate.kind)}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={entityProfileHref(trustedSiteUrl, candidate.slug)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                          aria-label={suggestionProfileAriaLabel(candidate.canonicalName)}
                        >
                          {ENTITY_LINK_ASSISTANT_COPY.VIEW_PROFILE}
                        </a>
                        <button
                          type="button"
                          disabled={disabled || relatedEntityIds.includes(candidate.entityId)}
                          aria-label={suggestionAddAriaLabel(candidate.canonicalName)}
                          onClick={() =>
                            onAdd({
                              id: candidate.entityId,
                              name: candidate.canonicalName,
                              kind: candidate.kind,
                              status: candidate.status,
                            })
                          }
                          className="inline-flex h-8 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                        >
                          {relatedEntityIds.includes(candidate.entityId)
                            ? ENTITY_LINK_ASSISTANT_COPY.ALREADY_RELATED
                            : ENTITY_LINK_ASSISTANT_COPY.ADD}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ) : (
              <li
                key={suggestion.entity.entityId}
                className="flex flex-col gap-2 rounded border border-zinc-200 bg-white p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-zinc-900">
                    {suggestion.entity.canonicalName}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {formatEntityKindLabel(suggestion.entity.kind)} ·{" "}
                    {ENTITY_LINK_ASSISTANT_COPY.PROFILE_EXISTS}
                    {suggestion.alreadyRelated
                      ? ` · ${ENTITY_LINK_ASSISTANT_COPY.ALREADY_RELATED}`
                      : null}
                    {suggestion.alreadyLinked
                      ? ` · ${ENTITY_LINK_ASSISTANT_COPY.ALREADY_LINKED}`
                      : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={entityProfileHref(trustedSiteUrl, suggestion.entity.slug)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    aria-label={suggestionProfileAriaLabel(suggestion.entity.canonicalName)}
                  >
                    {ENTITY_LINK_ASSISTANT_COPY.VIEW_PROFILE}
                  </a>
                  {suggestion.alreadyRelated ? (
                    <span role="status" className="inline-flex h-8 items-center text-xs text-zinc-600">
                      {ENTITY_LINK_ASSISTANT_COPY.ALREADY_RELATED}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={disabled}
                      aria-label={suggestionAddAriaLabel(suggestion.entity.canonicalName)}
                      onClick={() =>
                        onAdd({
                          id: suggestion.entity.entityId,
                          name: suggestion.entity.canonicalName,
                          kind: suggestion.entity.kind,
                          status: suggestion.entity.status,
                        })
                      }
                      className="inline-flex h-8 items-center rounded border border-zinc-300 px-2 text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
                    >
                      {ENTITY_LINK_ASSISTANT_COPY.ADD}
                    </button>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      ) : null}
    </section>
  );
}
