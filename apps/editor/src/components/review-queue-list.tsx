"use client";

import Link from "next/link";
import { deriveContentStatus } from "@/lib/content/status";
import { formatRelativeDate } from "@/lib/content/format-date";
import { buildArticleHref } from "@/lib/content/content-href";
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
  return (
    <div
      className={`overflow-x-auto border-y border-zinc-200 bg-white ${isPending ? "opacity-60" : ""}`}
      role="region"
      aria-label="İnceleme kuyruğu"
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
            <th className="px-4 py-2.5">Başlık</th>
            <th className="hidden px-4 py-2.5 md:table-cell">Kategori</th>
            <th className="px-4 py-2.5">Durum</th>
            <th className="hidden px-4 py-2.5 lg:table-cell">Yazar</th>
            <th className="hidden px-4 py-2.5 sm:table-cell">Bekleme</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ReviewQueueRow
              key={item.versionId}
              item={item}
              returnTo={returnTo}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewQueueRow({
  item,
  returnTo,
}: {
  item: ReviewQueueListItem;
  returnTo: string;
}) {
  const status = deriveContentStatus({
    publicationStatus: item.publicationStatus,
    workflowStatus: item.workflowStatus,
    publishedVersionId: item.publishedVersionId,
    draftVersionId: item.versionId,
    scheduledVersionId: item.scheduledVersionId,
    scheduledAt: item.scheduledAt,
    displayVersionId: item.versionId,
  });
  const href = buildArticleHref({
    contentItemId: item.contentItemId,
    versionId: item.versionId,
    from: "review",
    returnTo,
  });
  const title = item.title || "Başlıksız";

  return (
    <tr className="relative border-b border-zinc-50 last:border-b-0 hover:bg-zinc-50">
      <td className="px-4 py-3">
        <div className="min-w-0">
          <Link
            href={href}
            aria-label={`${title} incelemesini aç`}
            className="font-medium text-zinc-900 underline-offset-2 after:absolute after:inset-0 hover:underline focus:outline-none focus-visible:relative focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            {item.title || (
              <span className="italic text-zinc-400">Başlıksız</span>
            )}
          </Link>
          <p className="pointer-events-none mt-0.5 truncate text-xs text-zinc-500">
            {item.slug}
            {item.reviewRound > 0 ? ` · Tur ${item.reviewRound}` : ""}
          </p>
        </div>
      </td>
      <td className="pointer-events-none hidden px-4 py-3 md:table-cell">
        {item.primaryCategory ? (
          <span className="text-xs text-zinc-600">
            {item.primaryCategory.name}
          </span>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>
      <td className="pointer-events-none px-4 py-3">
        <div className="flex flex-wrap items-center gap-1">
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
        {item.authors.length > 0 ? (
          <span className="text-xs text-zinc-600">
            {item.authors.map((author) => author.displayName).join(", ")}
          </span>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>
      <td className="pointer-events-none hidden px-4 py-3 sm:table-cell">
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
