"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/content/format-date";
import {
  formatRevisionLabel,
  revisionPointerLabels,
  WORKFLOW_STATUS_LABELS,
  type RevisionHistoryItem,
} from "@/lib/content/revision-presentation";
import { ArticleVersionDiff } from "./article-version-diff";

type Props = {
  contentItemId: string;
  focusedVersionId: string | null;
  initialVersions: RevisionHistoryItem[];
  nextCursor: string | null;
};

type LoadState = "ready" | "loading" | "error";

export function ArticleRevisionPanel({
  contentItemId,
  focusedVersionId,
  initialVersions,
  nextCursor: initialCursor,
}: Props) {
  const [versions, setVersions] = useState(initialVersions);
  const [nextCursor, setNextCursor] = useState(initialCursor);
  const [state, setState] = useState<LoadState>("ready");
  const [compareFromId, setCompareFromId] = useState<string | null>(null);

  const compareToId = focusedVersionId ?? versions[0]?.id ?? null;

  async function loadOlder() {
    if (!nextCursor || state === "loading") {
      return;
    }
    setState("loading");
    try {
      const params = new URLSearchParams({
        limit: "8",
        cursor: nextCursor,
      });
      const response = await fetch(
        `/api/content/${contentItemId}/revisions?${params.toString()}`,
        { headers: { Accept: "application/json" } },
      );
      const body = (await response.json()) as {
        ok: boolean;
        data?: { versions: RevisionHistoryItem[]; nextCursor: string | null };
      };
      if (!response.ok || !body.ok || !body.data) {
        throw new Error("failed");
      }
      setVersions((current) => mergeRevisions(current, body.data!.versions));
      setNextCursor(body.data.nextCursor);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  return (
    <section aria-labelledby="revision-history-heading">
      <h2 id="revision-history-heading" className="text-sm font-semibold text-zinc-900">
        Sürüm geçmişi
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Kayıtlı sürümler ve aralarındaki farklar.
      </p>

      {versions.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">Henüz sürüm kaydı yok.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {versions.map((version) => {
            const pointers = revisionPointerLabels(version);
            const isFocused = version.id === focusedVersionId;
            return (
              <li key={version.id} className="text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900">
                      {formatRevisionLabel(version.versionNumber)}
                      {isFocused ? " · açık" : ""}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {version.title || "Başlıksız"}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {WORKFLOW_STATUS_LABELS[version.workflowStatus]}
                      {" · "}
                      <time dateTime={version.createdAt}>
                        {formatDateTime(version.createdAt)}
                      </time>
                    </p>
                    {pointers.length > 0 && (
                      <p className="mt-1 text-xs text-zinc-600">
                        {pointers.join(" · ")}
                      </p>
                    )}
                  </div>
                  {compareToId && version.id !== compareToId && (
                    <button
                      type="button"
                      onClick={() => setCompareFromId(version.id)}
                      className="shrink-0 rounded px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    >
                      Karşılaştır
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {state === "error" && (
        <p className="mt-3 text-sm text-red-700">
          Daha eski sürümler yüklenemedi.
        </p>
      )}

      {nextCursor && (
        <button
          type="button"
          onClick={() => void loadOlder()}
          disabled={state === "loading"}
          className="mt-3 text-xs font-medium text-zinc-600 underline hover:text-zinc-900 disabled:text-zinc-400"
        >
          {state === "loading" ? "Yükleniyor…" : "Daha eski sürümler"}
        </button>
      )}

      {compareFromId && compareToId && (
        <ArticleVersionDiff
          key={`${compareFromId}:${compareToId}`}
          contentItemId={contentItemId}
          fromVersionId={compareFromId}
          toVersionId={compareToId}
          onClose={() => setCompareFromId(null)}
        />
      )}
    </section>
  );
}

function mergeRevisions(
  current: RevisionHistoryItem[],
  incoming: RevisionHistoryItem[],
): RevisionHistoryItem[] {
  const seen = new Set(current.map((item) => item.id));
  const next = [...current];
  for (const item of incoming) {
    if (!seen.has(item.id)) {
      next.push(item);
    }
  }
  return next;
}
