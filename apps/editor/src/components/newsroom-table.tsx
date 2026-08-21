"use client";

import Link from "next/link";
import type { NewsroomListItem } from "./newsroom-desk";
import { deriveContentStatus } from "@/lib/content/status";
import { buildArticleHref } from "@/lib/content/content-href";
import { formatDateTime } from "@/lib/content/format-date";
import {
  attentionBadgeVariant,
  presentAttentionLabel,
} from "@/lib/content/newsroom-presentation";
import { RelativeTime } from "./relative-time";
import { StatusBadge } from "./status-badge";

type Props = {
  items: NewsroomListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isPending: boolean;
  returnTo: string;
};

export function NewsroomTable({
  items,
  selectedId,
  onSelect,
  isPending,
  returnTo,
}: Props) {
  return (
    <div className={isPending ? "opacity-60" : ""}>
      <div
        className="hidden overflow-x-auto border border-zinc-200 bg-white md:block"
        role="region"
        aria-label="Haber listesi"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2">Başlık</th>
              <th className="px-3 py-2">Yayın</th>
              <th className="px-3 py-2">İş Akışı</th>
              <th className="hidden px-3 py-2 lg:table-cell">Kategori</th>
              <th className="hidden px-3 py-2 xl:table-cell">Yazar</th>
              <th className="px-3 py-2">Güncelleme</th>
              <th className="hidden px-3 py-2 lg:table-cell">Zamanlama</th>
              <th className="px-3 py-2">Dikkat</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <NewsroomTableRow
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                onSelect={() => onSelect(item.id)}
                returnTo={returnTo}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 md:hidden" aria-label="Haber listesi">
        {items.map((item) => (
          <NewsroomCardRow
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            onSelect={() => onSelect(item.id)}
            returnTo={returnTo}
          />
        ))}
      </ul>
    </div>
  );
}

function NewsroomTableRow({
  item,
  selected,
  onSelect,
  returnTo,
}: {
  item: NewsroomListItem;
  selected: boolean;
  onSelect: () => void;
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
  const attentionLabel = presentAttentionLabel(item.attention);
  const href = buildArticleHref({
    contentItemId: item.id,
    returnTo,
  });

  return (
    <tr
      className={`cursor-pointer border-b border-zinc-50 last:border-b-0 hover:bg-zinc-50 ${
        selected ? "bg-zinc-50" : ""
      }`}
      onClick={onSelect}
      data-selected={selected ? "true" : undefined}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <td className="px-3 py-2.5">
        <div className="min-w-0">
          <Link
            href={href}
            onClick={(event) => event.stopPropagation()}
            className="font-medium text-zinc-900 underline-offset-2 hover:underline"
          >
            {item.displayVersion.title || (
              <span className="italic text-zinc-400">Başlıksız</span>
            )}
          </Link>
          <p className="mt-0.5 truncate text-xs text-zinc-500">{item.slug}</p>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge
          label={status.publicationLabel}
          variant={status.publicationVariant}
        />
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge
          label={status.workflowLabel}
          variant={status.workflowVariant}
        />
      </td>
      <td className="hidden px-3 py-2.5 lg:table-cell">
        {item.primaryCategory ? (
          <span className="text-xs text-zinc-600">{item.primaryCategory.name}</span>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>
      <td className="hidden px-3 py-2.5 xl:table-cell">
        {item.authors.length > 0 ? (
          <span className="text-xs text-zinc-600">
            {item.authors.map((author) => author.displayName).join(", ")}
          </span>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        <RelativeTime iso={item.updatedAt} className="text-xs text-zinc-500" />
      </td>
      <td className="hidden px-3 py-2.5 lg:table-cell">
        {item.scheduledAt ? (
          <time
            dateTime={item.scheduledAt}
            className="text-xs text-zinc-600"
            title={formatDateTime(item.scheduledAt)}
          >
            {formatDateTime(item.scheduledAt)}
          </time>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {attentionLabel ? (
          <AttentionBadge label={attentionLabel} item={item} />
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>
    </tr>
  );
}

function NewsroomCardRow({
  item,
  selected,
  onSelect,
  returnTo,
}: {
  item: NewsroomListItem;
  selected: boolean;
  onSelect: () => void;
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
  const attentionLabel = presentAttentionLabel(item.attention);
  const href = buildArticleHref({
    contentItemId: item.id,
    returnTo,
  });

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full rounded border px-3 py-3 text-left ${
          selected
            ? "border-zinc-900 bg-zinc-50"
            : "border-zinc-200 bg-white hover:bg-zinc-50"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={href}
              onClick={(event) => event.stopPropagation()}
              className="font-medium text-zinc-900 underline-offset-2 hover:underline"
            >
              {item.displayVersion.title || (
                <span className="italic text-zinc-400">Başlıksız</span>
              )}
            </Link>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{item.slug}</p>
          </div>
          {attentionLabel ? (
            <AttentionBadge label={attentionLabel} item={item} compact />
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <StatusBadge
            label={status.publicationLabel}
            variant={status.publicationVariant}
          />
          <StatusBadge
            label={status.workflowLabel}
            variant={status.workflowVariant}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          {item.primaryCategory ? <span>{item.primaryCategory.name}</span> : null}
          {item.authors.length > 0 ? (
            <span>{item.authors.map((author) => author.displayName).join(", ")}</span>
          ) : null}
          <RelativeTime iso={item.updatedAt} />
        </div>
      </button>
    </li>
  );
}

function AttentionBadge({
  label,
  item,
  compact = false,
}: {
  label: string;
  item: NewsroomListItem;
  compact?: boolean;
}) {
  const variant = attentionBadgeVariant(item.attention.severity);
  const classes =
    variant === "blocked"
      ? "bg-red-50 text-red-800"
      : variant === "warning"
        ? "bg-amber-50 text-amber-800"
        : "bg-zinc-100 text-zinc-700";

  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-medium leading-tight ${classes} ${
        compact ? "text-[10px]" : "text-[11px]"
      }`}
    >
      {label}
    </span>
  );
}
