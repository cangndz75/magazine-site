"use client";

import Link from "next/link";
import type { ContentListItem } from "./content-workspace";
import { deriveContentStatus } from "@/lib/content/status";
import { formatRelativeDate } from "@/lib/content/format-date";
import { buildArticleHref } from "@/lib/content/content-href";
import { StatusBadge } from "./status-badge";

type Props = {
  items: ContentListItem[];
  isPending: boolean;
  returnTo: string;
};

export function ContentList({ items, isPending, returnTo }: Props) {
  return (
    <div
      className={`overflow-x-auto border-y border-zinc-200 bg-white ${isPending ? "opacity-60" : ""}`}
      role="region"
      aria-label="İçerik listesi"
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
            <th className="px-4 py-2.5">Başlık</th>
            <th className="hidden px-4 py-2.5 md:table-cell">Kategori</th>
            <th className="px-4 py-2.5">Durum</th>
            <th className="hidden px-4 py-2.5 lg:table-cell">Yazar</th>
            <th className="hidden px-4 py-2.5 sm:table-cell">Güncelleme</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ContentRow key={item.id} item={item} returnTo={returnTo} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContentRow({
  item,
  returnTo,
}: {
  item: ContentListItem;
  returnTo: string;
}) {
  const status = deriveContentStatus({
    publicationStatus: item.publicationStatus,
    workflowStatus: item.displayVersion.workflowStatus,
    publishedVersionId: item.publishedVersionId,
    draftVersionId: item.draftVersionId,
    scheduledVersionId: item.scheduledVersionId,
    scheduledAt: item.scheduledAt,
    displayVersionId: item.displayVersion.id,
  });
  const href = buildArticleHref({
    contentItemId: item.id,
    returnTo,
  });
  const title = item.displayVersion.title || "Başlıksız";

  return (
    <tr className="relative border-b border-zinc-50 last:border-b-0 hover:bg-zinc-50">
      <td className="px-4 py-3">
        <div className="min-w-0">
          <Link
            href={href}
            aria-label={`${title} içeriğini aç`}
            className="font-medium text-zinc-900 underline-offset-2 after:absolute after:inset-0 hover:underline focus:outline-none focus-visible:relative focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            {item.displayVersion.title || (
              <span className="italic text-zinc-400">Başlıksız</span>
            )}
          </Link>
          <p className="pointer-events-none mt-0.5 truncate text-xs text-zinc-500">
            {item.slug}
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
          {status.scheduledLabel && (
            <StatusBadge label={status.scheduledLabel} variant="info" />
          )}
          {status.hasNewerDraft && (
            <span
              className="text-[10px] text-zinc-500"
              title="Yayındaki sürümden farklı bir taslak mevcut"
            >
              Yeni taslak
            </span>
          )}
        </div>
      </td>
      <td className="pointer-events-none hidden px-4 py-3 lg:table-cell">
        {item.authors.length > 0 ? (
          <span className="text-xs text-zinc-600">
            {item.authors.map((a) => a.displayName).join(", ")}
          </span>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>
      <td className="pointer-events-none hidden px-4 py-3 sm:table-cell">
        <time
          dateTime={item.updatedAt}
          className="text-xs text-zinc-500"
          title={new Date(item.updatedAt).toLocaleString("tr-TR")}
        >
          {formatRelativeDate(item.updatedAt)}
        </time>
      </td>
    </tr>
  );
}
