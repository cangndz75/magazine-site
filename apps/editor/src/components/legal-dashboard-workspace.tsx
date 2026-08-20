"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CONTENT_LEGAL_ACTION_TYPES } from "@magazine/domain";
import { formatDateTime } from "@/lib/content/format-date";
import {
  LEGAL_ACTION_LABELS,
  LEGAL_POLARITY_LABELS,
  LEGAL_REASON_LABELS,
  presentLegalCurrentState,
} from "@/lib/legal/presentation";

type ActiveHold = {
  contentItemId: string;
  slug: string;
  title: string;
  legalHoldAt: string;
  legalHoldReason: string;
  publicationStatus: string;
  actorDisplayName: string | null;
};

type DashboardEntry = {
  actionId: string;
  contentItemId: string;
  slug: string;
  articleTitle: string;
  actionType: string;
  polarity: string;
  reasonCategory: string;
  effectiveAt: string;
  createdAt: string;
  actor: { id: string; displayName: string };
  currentState: {
    publicationStatus: string;
    legalHoldAt: string | null;
    retractedAt: string | null;
    takedownAt: string | null;
  };
};

type ActorOption = { id: string; displayName: string };

export function LegalDashboardWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [activeHolds, setActiveHolds] = useState<ActiveHold[]>([]);
  const [entries, setEntries] = useState<DashboardEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [actors, setActors] = useState<ActorOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  const queryString = searchParams.toString();

  useEffect(() => {
    let active = true;
    void (async () => {
      const params = new URLSearchParams(queryString);
      const response = await fetch(`/api/legal?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      const body = (await response.json()) as {
        ok?: boolean;
        data?: {
          activeHolds: ActiveHold[];
          entries: DashboardEntry[];
          nextCursor: string | null;
          actors: ActorOption[];
        };
      };
      if (!active) {
        return;
      }
      if (!body.ok || !body.data) {
        setError("Yasal pano yüklenemedi.");
        return;
      }
      setError(null);
      setActiveHolds(body.data.activeHolds);
      setEntries(body.data.entries);
      setNextCursor(body.data.nextCursor);
      setActors(body.data.actors);
    })();
    return () => {
      active = false;
    };
  }, [queryString]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(queryString);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("cursor");
    startTransition(() => {
      router.push(`/legal?${params.toString()}`);
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Yasal ve düzeltmeler</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Aktif legal hold, son düzeltmeler ve hukuki işlemler.
        </p>
      </header>

      {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-zinc-900">Aktif legal hold</h2>
        {activeHolds.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">Aktif legal hold yok.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded border border-zinc-200 bg-white">
            {activeHolds.map((hold) => (
              <li key={hold.contentItemId} className="px-4 py-3 text-sm">
                <Link
                  href={`/content/${hold.contentItemId}`}
                  className="font-medium text-zinc-900 underline"
                >
                  {hold.title}
                </Link>
                <p className="mt-1 text-xs text-zinc-500">
                  {hold.slug} · {formatDateTime(hold.legalHoldAt)} ·{" "}
                  {LEGAL_REASON_LABELS[hold.legalHoldReason as keyof typeof LEGAL_REASON_LABELS]}
                  {hold.actorDisplayName ? ` · ${hold.actorDisplayName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-900">Son işlemler</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Başlık veya slug"
            value={searchParams.get("search") ?? ""}
            onChange={(event) => updateFilter("search", event.target.value)}
            className="h-9 min-w-0 flex-1 rounded border border-zinc-300 px-3 text-sm sm:max-w-xs"
          />
          <select
            value={searchParams.get("actionType") ?? ""}
            onChange={(event) => updateFilter("actionType", event.target.value)}
            className="h-9 rounded border border-zinc-300 px-2 text-sm"
          >
            <option value="">Tüm işlem türleri</option>
            {CONTENT_LEGAL_ACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {LEGAL_ACTION_LABELS[type]}
              </option>
            ))}
          </select>
          <select
            value={searchParams.get("actor") ?? ""}
            onChange={(event) => updateFilter("actor", event.target.value)}
            className="h-9 rounded border border-zinc-300 px-2 text-sm"
          >
            <option value="">Tüm personel</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.displayName}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={searchParams.get("activeHold") === "1"}
              onChange={(event) =>
                updateFilter("activeHold", event.target.checked ? "1" : "")
              }
            />
            Yalnızca hold
          </label>
        </div>

        {isPending ? (
          <p className="mt-3 text-sm text-zinc-500">Filtreler uygulanıyor…</p>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">İşlem</th>
                <th className="px-3 py-2">Haber</th>
                <th className="px-3 py-2">Tarih</th>
                <th className="px-3 py-2">Personel</th>
                <th className="px-3 py-2">Durum</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.actionId} className="border-b border-zinc-100">
                  <td className="px-3 py-2">
                    {LEGAL_ACTION_LABELS[entry.actionType as keyof typeof LEGAL_ACTION_LABELS]}
                    {entry.actionType === "LEGAL_HOLD"
                      ? ` (${LEGAL_POLARITY_LABELS[entry.polarity as keyof typeof LEGAL_POLARITY_LABELS]})`
                      : ""}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/content/${entry.contentItemId}`}
                      className="font-medium text-zinc-900 underline"
                    >
                      {entry.articleTitle}
                    </Link>
                    <span className="block text-xs text-zinc-500">{entry.slug}</span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDateTime(entry.effectiveAt)}
                  </td>
                  <td className="px-3 py-2">{entry.actor.displayName}</td>
                  <td className="px-3 py-2">
                    {presentLegalCurrentState({
                      legalHoldAt: entry.currentState.legalHoldAt,
                      retractedAt: entry.currentState.retractedAt,
                      takedownAt: entry.currentState.takedownAt,
                      publicationStatus: entry.currentState.publicationStatus,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {nextCursor ? (
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(queryString);
              params.set("cursor", nextCursor);
              void fetch(`/api/legal?${params.toString()}`, {
                headers: { Accept: "application/json" },
              })
                .then((response) => response.json())
                .then((body: {
                  ok?: boolean;
                  data?: { entries: DashboardEntry[]; nextCursor: string | null };
                }) => {
                  if (body.ok && body.data) {
                    setEntries((current) => [...current, ...body.data!.entries]);
                    setNextCursor(body.data!.nextCursor);
                  }
                });
            }}
            className="mt-4 h-9 rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
          >
            Daha fazla
          </button>
        ) : null}
      </section>
    </div>
  );
}
