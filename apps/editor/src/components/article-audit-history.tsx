"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/content/format-date";
import {
  AUDIT_HISTORY_TEXT,
  mergeAuditEvents,
  presentAuditEvent,
  type EditorAuditEvent,
} from "@/lib/content/audit-presentation";

type Props = {
  contentItemId: string;
  isOpen: boolean;
  refreshKey: number;
};

type LoadState = "idle" | "loading" | "ready" | "error";

type AuditResponse = {
  ok: boolean;
  data?: {
    items: EditorAuditEvent[];
    nextCursor: string | null;
  };
};

const PAGE_LIMIT = 12;

export function ArticleAuditHistory({ contentItemId, isOpen, refreshKey }: Props) {
  const [items, setItems] = useState<EditorAuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("idle");
  const [isAppending, setIsAppending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadFirstPage = useCallback(async () => {
    setState("loading");
    try {
      const page = await fetchAuditPage(contentItemId, null);
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setLoaded(true);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [contentItemId]);

  useEffect(() => {
    if (!isOpen || loaded) {
      return;
    }

    let active = true;
    void fetchAuditPage(contentItemId, null)
      .then((page) => {
        if (!active) {
          return;
        }
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setLoaded(true);
        setState("ready");
      })
      .catch(() => {
        if (active) {
          setState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [contentItemId, isOpen, loaded]);

  useEffect(() => {
    if (!isOpen || !loaded || refreshKey === 0) {
      return;
    }

    let active = true;
    void fetchAuditPage(contentItemId, null)
      .then((page) => {
        if (!active) {
          return;
        }
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setState("ready");
      })
      .catch(() => {
        if (active) {
          setState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [contentItemId, isOpen, loaded, refreshKey]);

  async function loadOlder() {
    if (!nextCursor || isAppending) {
      return;
    }

    setIsAppending(true);
    try {
      const page = await fetchAuditPage(contentItemId, nextCursor);
      setItems((current) => mergeAuditEvents(current, page.items));
      setNextCursor(page.nextCursor);
      setState("ready");
    } catch {
      setState("error");
    } finally {
      setIsAppending(false);
    }
  }

  const presented = useMemo(() => items.map(presentAuditEvent), [items]);

  return (
    <section
      aria-labelledby="article-audit-history-title"
      className="rounded border border-zinc-200 bg-white p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2
            id="article-audit-history-title"
            className="text-sm font-semibold text-zinc-900"
          >
            {AUDIT_HISTORY_TEXT.title}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {AUDIT_HISTORY_TEXT.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadFirstPage()}
          disabled={state === "loading"}
          className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:text-zinc-300"
        >
          Yenile
        </button>
      </div>

      {(state === "loading" || (isOpen && !loaded && state === "idle")) && (
        <div
          role="status"
          className="rounded border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600"
        >
          {AUDIT_HISTORY_TEXT.loading}
        </div>
      )}

      {state === "error" && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
          <p>{AUDIT_HISTORY_TEXT.error}</p>
          <button
            type="button"
            onClick={() => void loadFirstPage()}
            className="mt-2 rounded bg-white px-2 py-1 text-xs font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            {AUDIT_HISTORY_TEXT.retry}
          </button>
        </div>
      )}

      {state === "ready" && presented.length === 0 && (
        <p className="rounded border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
          {AUDIT_HISTORY_TEXT.empty}
        </p>
      )}

      {presented.length > 0 && (
        <ol className="space-y-4">
          {presented.map((event) => (
            <li
              key={event.id}
              className="border-l border-zinc-200 pl-3"
            >
              <article>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-zinc-950">
                      {event.actionLabel}
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {event.actorLabel} · {event.actorKindLabel}
                    </p>
                  </div>
                  <time
                    dateTime={event.occurredAt}
                    className="shrink-0 text-xs text-zinc-500"
                  >
                    {formatDateTime(event.occurredAt)}
                  </time>
                </div>

                <AuditChangeSet event={event} />
              </article>
            </li>
          ))}
        </ol>
      )}

      {state === "ready" && nextCursor && (
        <button
          type="button"
          onClick={() => void loadOlder()}
          disabled={isAppending}
          className="mt-4 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-300"
        >
          {isAppending ? AUDIT_HISTORY_TEXT.refreshing : AUDIT_HISTORY_TEXT.loadMore}
        </button>
      )}
    </section>
  );
}

function AuditChangeSet({
  event,
}: {
  event: ReturnType<typeof presentAuditEvent>;
}) {
  const hasChanges =
    event.scalarChanges.length > 0 ||
    event.bodyChange ||
    event.relationChanges.length > 0 ||
    event.detailLimited;

  if (!hasChanges) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2 text-sm text-zinc-700">
      {event.scalarChanges.map((change) => (
        <div
          key={`${change.fieldLabel}:${change.summary}`}
          className="rounded bg-zinc-50 px-2.5 py-2"
        >
          <p className="font-medium text-zinc-900">{change.summary}</p>
          <ScalarValueChange change={change} />
        </div>
      ))}

      {event.bodyChange && (
        <div className="rounded bg-zinc-50 px-2.5 py-2">
          <p className="font-medium text-zinc-900">{event.bodyChange.label}</p>
          {event.bodyChange.detailLimited && (
            <p className="mt-1 text-xs text-zinc-500">
              {AUDIT_HISTORY_TEXT.limited}
            </p>
          )}
        </div>
      )}

      {event.relationChanges.map((change) => (
        <div key={change.label} className="rounded bg-zinc-50 px-2.5 py-2">
          <p className="font-medium text-zinc-900">{change.label}</p>
          <p className="mt-1 text-xs text-zinc-500">{change.summary}</p>
          {change.detailLimited && (
            <p className="mt-1 text-xs text-zinc-500">
              {AUDIT_HISTORY_TEXT.limited}
            </p>
          )}
        </div>
      ))}

      {event.detailLimited && (
        <p className="text-xs text-zinc-500">{AUDIT_HISTORY_TEXT.limited}</p>
      )}
    </div>
  );
}

function ScalarValueChange({
  change,
}: {
  change: ReturnType<typeof presentAuditEvent>["scalarChanges"][number];
}) {
  if (change.before === null && change.after !== null) {
    return <ValueBlock label="Sonra" value={change.after} multiline={change.multiline} />;
  }
  if (change.before !== null && change.after === null) {
    return <ValueBlock label="Önce" value={change.before} multiline={change.multiline} />;
  }
  return (
    <div
      className={
        change.multiline
          ? "mt-2 grid gap-2"
          : "mt-2 grid gap-2 text-xs sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      }
    >
      <ValueBlock label="Önce" value={change.before ?? "—"} multiline={change.multiline} />
      <ValueBlock label="Sonra" value={change.after ?? "—"} multiline={change.multiline} />
    </div>
  );
}

function ValueBlock({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline: boolean;
}) {
  return (
    <div className={multiline ? "mt-2" : ""}>
      <span className="block text-xs font-medium text-zinc-500">{label}</span>
      <span className="mt-0.5 block break-words text-xs text-zinc-800">
        {value}
      </span>
    </div>
  );
}

async function fetchAuditPage(
  contentItemId: string,
  cursor: string | null,
): Promise<{ items: EditorAuditEvent[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
  if (cursor) {
    params.set("cursor", cursor);
  }

  const response = await fetch(
    `/api/content/${contentItemId}/audit?${params.toString()}`,
    { headers: { Accept: "application/json" } },
  );
  const body = (await response.json()) as AuditResponse;

  if (!response.ok || !body.ok || !body.data) {
    throw new Error("Audit history request failed.");
  }

  return body.data;
}
