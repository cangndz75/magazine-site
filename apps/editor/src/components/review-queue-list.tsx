"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { deriveContentStatus } from "@/lib/content/status";
import { formatRelativeDate } from "@/lib/content/format-date";
import { buildArticleHref } from "@/lib/content/content-href";
import {
  presentAttentionLabel,
  presentNewsroomReadinessState,
  presentNewsroomReadinessSummary,
} from "@/lib/content/newsroom-presentation";
import { StatusBadge } from "./status-badge";
import type { ReviewQueueListItem } from "./review-queue-workspace";

export function ReviewQueueList({
  items,
  isPending,
  returnTo,
}: {
  items: ReviewQueueListItem[];
  isPending: boolean;
  returnTo: string;
}) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    items[0]?.versionId ?? null,
  );
  const selected = useMemo(
    () =>
      selectedVersionId
        ? items.find((item) => item.versionId === selectedVersionId) ?? null
        : null,
    [items, selectedVersionId],
  );

  useEffect(() => {
    if (!selected) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedVersionId(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected]);

  return (
    <div
      className={`grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] ${isPending ? "opacity-60" : ""}`}
    >
      <div
        className="hidden overflow-x-auto border-y border-zinc-200 bg-white md:block"
        role="region"
        aria-label="İnceleme kuyruğu"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-2.5">Başlık</th>
              <th className="px-4 py-2.5">Kategori</th>
              <th className="px-4 py-2.5">Yayın / iş akışı</th>
              <th className="hidden px-4 py-2.5 lg:table-cell">Hazırlık</th>
              <th className="hidden px-4 py-2.5 lg:table-cell">Yazar</th>
              <th className="px-4 py-2.5">Bekleme</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <ReviewQueueRow
                key={item.versionId}
                item={item}
                returnTo={returnTo}
                selected={item.versionId === selected?.versionId}
                onSelect={() => setSelectedVersionId(item.versionId)}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden" aria-label="İnceleme kuyruğu mobil">
        {items.map((item) => (
          <ReviewQueueCard key={item.versionId} item={item} returnTo={returnTo} />
        ))}
      </div>

      {selected && (
        <>
          <ReviewInspector
            item={selected}
            returnTo={returnTo}
            variant="inline"
            onClose={() => setSelectedVersionId(null)}
          />
          <ReviewInspector item={selected} returnTo={returnTo} variant="rail" />
        </>
      )}
    </div>
  );
}

function ReviewQueueRow({
  item,
  returnTo,
  selected,
  onSelect,
}: {
  item: ReviewQueueListItem;
  returnTo: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = reviewStatus(item);
  const href = reviewHref(item, returnTo);
  const title = item.title || "Başlıksız";
  const readinessState = presentNewsroomReadinessState(item.readiness);
  const attention = presentAttentionLabel(item.attention);
  return (
    <tr
      className={`relative border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 ${selected ? "bg-fuchsia-50/70 shadow-[inset_3px_0_0_#be185d]" : ""}`}
      aria-selected={selected}
      onClick={onSelect}
    >
      <td className="px-4 py-3">
        <div className="min-w-0">
          <Link
            href={href}
            aria-label={`${title} incelemesini aç`}
            onClick={(event) => event.stopPropagation()}
            className="relative z-10 font-medium text-zinc-900 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            {item.title || <span className="italic text-zinc-400">Başlıksız</span>}
          </Link>
          <p className="pointer-events-none mt-0.5 truncate text-xs text-zinc-500">
            S{item.versionNumber} / {item.slug}
            {item.reviewRound > 0 ? ` / Tur ${item.reviewRound}` : ""}
          </p>
        </div>
      </td>
      <td className="pointer-events-none px-4 py-3">
        <span className="text-xs text-zinc-600">
          {item.primaryCategory?.name ?? "Yok"}
        </span>
      </td>
      <td className="pointer-events-none px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge
            label={status.publicationLabel}
            variant={status.publicationVariant}
          />
          <StatusBadge
            label={status.workflowLabel}
            variant={status.workflowVariant}
          />
        </div>
      </td>
      <td className="pointer-events-none hidden px-4 py-3 lg:table-cell">
        <p className="text-xs font-medium text-zinc-800">{readinessState}</p>
        <p className={`mt-0.5 text-xs ${attention ? "text-amber-700" : "text-zinc-400"}`}>
          {attention ?? "Engel yok"}
        </p>
      </td>
      <td className="pointer-events-none hidden px-4 py-3 lg:table-cell">
        <span className="text-xs text-zinc-600">
          {item.authors.map((author) => author.displayName).join(", ") || "Yok"}
        </span>
      </td>
      <td className="pointer-events-none px-4 py-3">
        <time
          dateTime={item.latestSubmittedAt}
          className="text-xs text-zinc-500"
          title={new Date(item.latestSubmittedAt).toLocaleString("tr-TR")}
        >
          {formatRelativeDate(item.latestSubmittedAt)}
        </time>
      </td>
    </tr>
  );
}

function ReviewQueueCard({
  item,
  returnTo,
}: {
  item: ReviewQueueListItem;
  returnTo: string;
}) {
  const href = reviewHref(item, returnTo);

  return (
    <article className="border-y border-zinc-200 bg-white px-3 py-3">
      <Link
        href={href}
        className="text-sm font-semibold text-zinc-900 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
      >
        {item.title || "Başlıksız"}
      </Link>
      <p className="mt-1 text-xs text-zinc-500">
        {item.primaryCategory?.name ?? "Kategori yok"} / S{item.versionNumber} /{" "}
        {formatRelativeDate(item.latestSubmittedAt)}
      </p>
      <p className="mt-2 text-xs font-medium text-zinc-700">
        {presentNewsroomReadinessState(item.readiness)}
      </p>
    </article>
  );
}

function ReviewInspector({
  item,
  returnTo,
  variant,
  onClose,
}: {
  item: ReviewQueueListItem;
  returnTo: string;
  variant: "inline" | "rail";
  onClose?: () => void;
}) {
  const href = reviewHref(item, returnTo);
  const status = reviewStatus(item);
  const attention = presentAttentionLabel(item.attention);
  const className =
    variant === "rail"
      ? "hidden border border-zinc-200 bg-white p-4 xl:block"
      : "border border-zinc-200 bg-white p-4 xl:hidden";

  return (
    <aside
      className={className}
      aria-label="İnceleme ayrıntıları"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-700">
        Karar alanı
        </p>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            Kapat
          </button>
        ) : null}
      </div>
      <h2 className="mt-2 text-base font-semibold leading-6 text-zinc-950">
        {item.title || "Başlıksız"}
      </h2>
      <p className="mt-1 text-xs text-zinc-500">{item.slug}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <InspectorFact label="Yayın" value={status.publicationLabel} />
        <InspectorFact label="İş akışı" value={status.workflowLabel} />
        <InspectorFact label="Açık sürüm" value={`S${item.versionNumber}`} />
        <InspectorFact
          label="Yayındaki"
          value={item.publishedVersionId ? "Ayrı sürüm var" : "Yok"}
        />
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Hazırlık
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-900">
          {presentNewsroomReadinessState(item.readiness)}
        </p>
        <p className="mt-1 text-xs text-zinc-600">
          {presentNewsroomReadinessSummary(item.readiness)}
        </p>
        {attention && (
          <p className="mt-2 border-l-2 border-amber-500 pl-2 text-xs text-amber-800">
            {attention}
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4 text-xs text-zinc-600">
        <p>
          <span className="font-medium text-zinc-900">Kategori:</span>{" "}
          {item.primaryCategory?.name ?? "Yok"}
        </p>
        <p className="mt-1">
          <span className="font-medium text-zinc-900">Yazar:</span>{" "}
          {item.authors.map((author) => author.displayName).join(", ") || "Yok"}
        </p>
        <p className="mt-1">
          <span className="font-medium text-zinc-900">Gönderim:</span>{" "}
          {new Date(item.latestSubmittedAt).toLocaleString("tr-TR")}
        </p>
      </div>

      <Link
        href={href}
        className="mt-5 inline-flex h-9 w-full items-center justify-center rounded bg-zinc-950 px-3 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500"
      >
        Sürümü incele
      </Link>
      <p className="mt-2 text-xs text-zinc-500">
        Onay yayınlamak değildir; yayın kararı ayrı iş akışında kalır.
      </p>
    </aside>
  );
}

function InspectorFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-200 px-2.5 py-2">
      <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 font-medium text-zinc-900">{value}</p>
    </div>
  );
}

function reviewHref(item: ReviewQueueListItem, returnTo: string): string {
  return buildArticleHref({
    contentItemId: item.contentItemId,
    versionId: item.versionId,
    from: "review",
    returnTo,
  });
}

function reviewStatus(item: ReviewQueueListItem) {
  return deriveContentStatus({
    publicationStatus: item.publicationStatus,
    workflowStatus: item.workflowStatus,
    publishedVersionId: item.publishedVersionId,
    draftVersionId: item.versionId,
    scheduledVersionId: item.scheduledVersionId,
    scheduledAt: item.scheduledAt,
    displayVersionId: item.versionId,
  });
}
