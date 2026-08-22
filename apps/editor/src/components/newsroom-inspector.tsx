"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { WORKFLOW_STATUS } from "@magazine/domain";
import type { NewsroomListItem } from "./newsroom-desk";
import { deriveContentStatus } from "@/lib/content/status";
import { buildArticleHref } from "@/lib/content/content-href";
import { formatDateTime } from "@/lib/content/format-date";
import {
  presentAttentionLabel,
  presentNewsroomReadinessState,
  presentNewsroomReadinessSummary,
} from "@/lib/content/newsroom-presentation";
import { RelativeTime } from "./relative-time";
import { StatusBadge } from "./status-badge";

type Props = {
  item: NewsroomListItem | null;
  returnTo: string;
  onClose: () => void;
  variant: "rail" | "drawer";
};

export function NewsroomInspector({ item, returnTo, onClose, variant }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!item || variant !== "drawer") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [item, onClose, variant]);

  if (!item) {
    return null;
  }

  const body = <InspectorBody item={item} returnTo={returnTo} onClose={onClose} />;

  if (variant === "drawer") {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">İçerik özeti</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            Kapat
          </button>
        </div>
        <div className="overflow-y-auto p-4">{body}</div>
      </div>
    );
  }

  return (
    <div className="sticky top-5 flex max-h-[calc(100vh-2.5rem)] min-h-[420px] flex-col overflow-hidden rounded border border-zinc-200 bg-white shadow-sm shadow-zinc-200/40">
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">İçerik özeti</h2>
      </div>
      <div className="overflow-y-auto p-4">{body}</div>
    </div>
  );
}

function InspectorBody({
  item,
  returnTo,
  onClose,
}: {
  item: NewsroomListItem;
  returnTo: string;
  onClose: () => void;
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
  const editorHref = buildArticleHref({
    contentItemId: item.id,
    returnTo,
  });
  const inReview = item.displayVersion.workflowStatus === WORKFLOW_STATUS.IN_REVIEW;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Tür
        </p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">
          {item.contentKind === "GALLERY" ? "Foto Galeri" : "Haber"}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          Başlık
        </p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">
          {item.displayVersion.title || "Başlıksız"}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500">{item.slug}</p>
      </div>

      <div className="flex flex-wrap gap-1">
        <StatusBadge
          label={status.publicationLabel}
          variant={status.publicationVariant}
        />
        <StatusBadge
          label={status.workflowLabel}
          variant={status.workflowVariant}
        />
        {status.scheduledLabel ? (
          <StatusBadge label={status.scheduledLabel} variant="info" />
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-zinc-500">Kategori</dt>
          <dd className="mt-0.5 text-zinc-800">
            {item.primaryCategory?.name ?? "-"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Yazar</dt>
          <dd className="mt-0.5 text-zinc-800">
            {item.authors.length > 0
              ? item.authors.map((author) => author.displayName).join(", ")
              : "-"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Güncelleme</dt>
          <dd className="mt-0.5 text-zinc-800">
            <RelativeTime iso={item.updatedAt} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Zamanlama</dt>
          <dd className="mt-0.5 text-zinc-800">
            {item.scheduledAt ? formatDateTime(item.scheduledAt) : "-"}
          </dd>
        </div>
      </dl>

      {item.displayVersion.excerpt ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            Spot
          </p>
          <p className="mt-1 text-sm text-zinc-700">{item.displayVersion.excerpt}</p>
        </div>
      ) : null}

      <div className="rounded border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Yayın hazırlığı
            </p>
            <p className="mt-1 text-sm text-zinc-800">
              {presentNewsroomReadinessSummary(item.readiness)}
            </p>
          </div>
          <ReadinessStateBadge state={presentNewsroomReadinessState(item.readiness)} />
        </div>
        {attentionLabel ? (
          <p className="mt-2 text-xs text-zinc-600">Dikkat: {attentionLabel}</p>
        ) : null}
        {item.changesRequestedNote ? (
          <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
            {item.changesRequestedNote}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href={editorHref}
          onClick={onClose}
          className="inline-flex h-8 items-center rounded bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800"
        >
          Editörde Aç
        </Link>
        {inReview ? (
          <Link
            href="/review"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            İnceleme kuyruğu
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ReadinessStateBadge({ state }: { state: string }) {
  const classes =
    state === "Engelli"
      ? "bg-red-50 text-red-800"
      : state === "Kontrol edilmeli"
        ? "bg-amber-50 text-amber-800"
        : "bg-emerald-50 text-emerald-800";

  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${classes}`}
    >
      {state}
    </span>
  );
}
