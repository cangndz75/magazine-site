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
        className="hidden overflow-x-auto rounded border border-zinc-200 bg-white shadow-sm shadow-zinc-200/40 md:block"
        role="region"
        aria-label="Haber listesi"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <th className="px-4 py-3">Başlık</th>
              <th className="px-3 py-3">Yayın</th>
              <th className="px-3 py-3">İş Akışı</th>
              <th className="hidden px-3 py-3 lg:table-cell">Kategori</th>
              <th className="hidden px-3 py-3 xl:table-cell">Yazar</th>
              <th className="px-3 py-3">Güncelleme</th>
              <th className="hidden px-3 py-3 lg:table-cell">Zamanlama</th>
              <th className="px-3 py-3">Dikkat</th>
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
      className={`cursor-pointer border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50 ${
        selected ? "bg-zinc-50 shadow-[inset_3px_0_0_#18181b]" : ""
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
      <td className="px-4 py-3">
        <div className="min-w-0">
          <Link
            href={href}
            onClick={(event) => event.stopPropagation()}
            className="font-semibold text-zinc-950 underline-offset-2 hover:underline"
          >
            {item.displayVersion.title || (
              <span className="italic text-zinc-400">Başlıksız</span>
            )}
          </Link>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
            <ContentKindBadge kind={item.contentKind} />
            <span className="truncate text-xs text-zinc-500">{item.slug}</span>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        <StatusBadge
          label={status.publicationLabel}
          variant={status.publicationVariant}
        />
      </td>
      <td className="px-3 py-3">
        <StatusBadge
          label={status.workflowLabel}
          variant={status.workflowVariant}
        />
      </td>
      <td className="hidden px-3 py-3 lg:table-cell">
        {item.primaryCategory ? (
          <span className="text-xs text-zinc-600">{item.primaryCategory.name}</span>
        ) : (
          <span className="text-xs text-zinc-300">-</span>
        )}
      </td>
      <td className="hidden px-3 py-3 xl:table-cell">
        {item.authors.length > 0 ? (
          <span className="text-xs text-zinc-600">
            {item.authors.map((author) => author.displayName).join(", ")}
          </span>
        ) : (
          <span className="text-xs text-zinc-300">-</span>
        )}
      </td>
      <td className="px-3 py-3">
        <RelativeTime iso={item.updatedAt} className="text-xs text-zinc-500" />
      </td>
      <td className="hidden px-3 py-3 lg:table-cell">
        {item.scheduledAt ? (
          <time
            dateTime={item.scheduledAt}
            className="text-xs text-zinc-600"
            title={formatDateTime(item.scheduledAt)}
          >
            {formatDateTime(item.scheduledAt)}
          </time>
        ) : (
          <span className="text-xs text-zinc-300">-</span>
        )}
      </td>
      <td className="px-3 py-3">
        {attentionLabel ? (
          <AttentionBadge label={attentionLabel} item={item} />
        ) : (
          <span className="text-xs text-zinc-300">-</span>
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
    <li
      className={`rounded border px-3 py-3 shadow-sm shadow-zinc-200/40 ${
        selected
          ? "border-zinc-900 bg-white"
          : "border-zinc-200 bg-white hover:bg-zinc-50"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <ContentKindBadge kind={item.contentKind} />
            <p className="mt-1 font-semibold text-zinc-950">
              {item.displayVersion.title || (
                <span className="italic text-zinc-400">Başlıksız</span>
              )}
            </p>
            <p className="mt-0.5 truncate text-xs text-zinc-500">{item.slug}</p>
          </div>
          {attentionLabel ? (
            <AttentionBadge label={attentionLabel} item={item} compact />
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <StatusBadge
            label={status.publicationLabel}
            variant={status.publicationVariant}
          />
          <StatusBadge
            label={status.workflowLabel}
            variant={status.workflowVariant}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          {item.primaryCategory ? <span>{item.primaryCategory.name}</span> : null}
          {item.authors.length > 0 ? (
            <span>{item.authors.map((author) => author.displayName).join(", ")}</span>
          ) : null}
          <RelativeTime iso={item.updatedAt} />
        </div>
      </button>
      <Link
        href={href}
        className="mt-3 inline-flex h-8 items-center rounded border border-zinc-300 px-2.5 text-xs font-medium text-zinc-700 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
      >
        Editörde Aç
      </Link>
    </li>
  );
}

function ContentKindBadge({ kind }: { kind: NewsroomListItem["contentKind"] }) {
  const isGallery = kind === "GALLERY";

  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight ${
        isGallery ? "bg-sky-50 text-sky-800" : "bg-zinc-100 text-zinc-700"
      }`}
    >
      {isGallery ? "Foto Galeri" : "Haber"}
    </span>
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
