"use client";

import Link from "next/link";
import type { ContentListItem } from "./content-workspace";
import { deriveContentStatus } from "@/lib/content/status";
import { formatRelativeDate } from "@/lib/content/format-date";

type Props = {
  items: ContentListItem[];
  isPending: boolean;
  returnTo: string;
};

export function ContentList({ items, isPending, returnTo }: Props) {
  return (
    <div
      className={`overflow-x-auto rounded border border-zinc-200 bg-white ${isPending ? "opacity-60" : ""}`}
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

  return (
    <tr className="border-b border-zinc-50 hover:bg-zinc-25 transition-colors last:border-b-0">
      <td className="px-4 py-3">
        <div className="min-w-0">
          <Link
            href={`/content/${item.id}?returnTo=${encodeURIComponent(returnTo)}`}
            className="block truncate font-medium text-zinc-900 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            {item.displayVersion.title || (
              <span className="italic text-zinc-400">Başlıksız</span>
            )}
          </Link>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{item.slug}</p>
        </div>
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        {item.primaryCategory ? (
          <span className="text-xs text-zinc-600">
            {item.primaryCategory.name}
          </span>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>
      <td className="px-4 py-3">
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
            <span className="text-[10px] text-zinc-400" title="Yayındaki versiyondan farklı bir taslak mevcut">
              +taslak
            </span>
          )}
        </div>
      </td>
      <td className="hidden px-4 py-3 lg:table-cell">
        {item.authors.length > 0 ? (
          <span className="text-xs text-zinc-600">
            {item.authors.map((a) => a.displayName).join(", ")}
          </span>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
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

function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: "neutral" | "success" | "warning" | "info";
}) {
  const classes: Record<string, string> = {
    neutral: "bg-zinc-100 text-zinc-600",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    info: "bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ${classes[variant]}`}
    >
      {label}
    </span>
  );
}
