"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { buildArticleHref } from "@/lib/content/content-href";
import {
  formatAnalyticsCount,
  formatAnalyticsCtr,
} from "@/lib/analytics/presentation";
import type { AnalyticsContentItemDto } from "@/lib/analytics/types";

type Props = {
  item: AnalyticsContentItemDto | null;
  onClose: () => void;
  variant: "rail" | "drawer";
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Taslak",
  IN_REVIEW: "İncelemede",
  APPROVED: "Onaylandı",
  PUBLISHED: "Yayında",
  SCHEDULED: "Zamanlanmış",
  UNPUBLISHED: "Yayından kaldırıldı",
  NEVER_PUBLISHED: "Hiç yayınlanmadı",
};

function ContentPanelBody({ item }: { item: AnalyticsContentItemDto }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">İçerik</p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">
          {item.display?.title ?? item.contentItemId}
        </p>
        {item.display && (
          <p className="mt-0.5 text-xs text-zinc-500">
            {STATUS_LABEL[item.display.publicationStatus] ?? item.display.publicationStatus}
            {item.display.primaryCategoryName ? ` · ${item.display.primaryCategoryName}` : ""}
          </p>
        )}
      </div>

      {item.display && item.display.authors.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Yazarlar</p>
          <p className="mt-1 text-sm text-zinc-700">
            {item.display.authors.map((author) => author.displayName).join(", ")}
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-zinc-500">Görüntüleme</dt>
          <dd className="font-semibold text-zinc-900">{formatAnalyticsCount(item.articleViews)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Anasayfa Gösterim</dt>
          <dd className="font-semibold text-zinc-900">
            {formatAnalyticsCount(item.homepageImpressions)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Anasayfa Tıklama</dt>
          <dd className="font-semibold text-zinc-900">
            {formatAnalyticsCount(item.homepageClicks)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">CTR</dt>
          <dd className="font-semibold text-zinc-900">{formatAnalyticsCtr(item.homepageCtr)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Galeri Açılışı</dt>
          <dd className="font-semibold text-zinc-900">{formatAnalyticsCount(item.galleryOpens)}</dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Galeri Görüntüleme</dt>
          <dd className="font-semibold text-zinc-900">
            {formatAnalyticsCount(item.galleryImageViews)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-zinc-500">Video Gösterim</dt>
          <dd className="font-semibold text-zinc-900">
            {formatAnalyticsCount(item.videoImpressions)}
          </dd>
        </div>
      </dl>

      <Link
        href={buildArticleHref({ contentItemId: item.contentItemId })}
        className="inline-block rounded border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Editörde aç
      </Link>
    </div>
  );
}

export function AnalyticsContentPanel({ item, onClose, variant }: Props) {
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

  if (variant === "rail") {
    return (
      <div className="rounded border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">İçerik Detayı</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-zinc-500 hover:text-zinc-700"
          >
            Kapat
          </button>
        </div>
        <ContentPanelBody item={item} />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="absolute inset-x-0 bottom-0 max-h-[min(75vh,calc(100dvh-3rem))] overflow-y-auto rounded-t-lg border-t border-zinc-200 bg-white p-4 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label="İçerik detayı"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">İçerik Detayı</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
          >
            Kapat
          </button>
        </div>
        <ContentPanelBody item={item} />
      </div>
    </div>
  );
}
