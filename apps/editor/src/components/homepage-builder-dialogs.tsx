"use client";

import { useEffect, useRef } from "react";
import type { HomepageBuilderView } from "@/lib/homepage/builder-types";
import {
  analyzePublishEligibility,
  countDraftChanges,
} from "@/lib/homepage/builder-utils";
import { HOMEPAGE_SLOT_LABEL } from "@/lib/homepage/slot-meta";
import { HomepageBuilderComposition } from "./homepage-builder-composition";

type PublishDialogProps = {
  open: boolean;
  builder: HomepageBuilderView;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function HomepagePublishDialog({
  open,
  builder,
  pending,
  onClose,
  onConfirm,
}: PublishDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const eligibility = analyzePublishEligibility(builder);
  const changes = countDraftChanges(builder);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed left-1/2 top-1/2 z-50 hidden w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white p-0 shadow-lg backdrop:bg-zinc-900/40 open:flex max-h-[min(90dvh,calc(100vh-2rem))]"
      aria-labelledby="homepage-publish-title"
    >
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 id="homepage-publish-title" className="text-base font-semibold text-zinc-900">
          Ana sayfayı yayınla
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Taslak düzeni canlı ana sayfaya atomik olarak uygulanır.
        </p>
      </div>
      <div className="space-y-3 px-5 py-4 text-sm text-zinc-700">
        <p>
          <span className="font-medium">{changes}</span> slot değişikliği
        </p>
        <p>
          Atanan: <span className="font-medium">{eligibility.assignedCount}</span> · Boş:{" "}
          <span className="font-medium">{eligibility.emptyCount}</span>
        </p>
        {eligibility.emptyCount > 0 && (
          <p className="text-xs text-zinc-500">
            Boş slotlar yayın sonrası güvenli geri dönüşle doldurulur.
          </p>
        )}
        {eligibility.blockingCount > 0 && (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">
              {eligibility.blockingCount} içerik henüz yayında değil
            </p>
            <ul className="mt-1 list-inside list-disc">
              {eligibility.blockers.map((blocker) => (
                <li key={blocker.slotKey}>
                  {HOMEPAGE_SLOT_LABEL[blocker.slotKey]}: {blocker.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Vazgeç
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending || eligibility.blockingCount > 0}
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {pending ? "Yayınlanıyor…" : "Ana sayfayı yayınla"}
        </button>
      </div>
    </dialog>
  );
}

type PreviewDialogProps = {
  open: boolean;
  builder: HomepageBuilderView;
  onClose: () => void;
};

export function HomepagePreviewDialog({
  open,
  builder,
  onClose,
}: PreviewDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed left-1/2 top-1/2 z-50 hidden w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-0 shadow-lg backdrop:bg-zinc-900/40 open:flex max-h-[min(90dvh,calc(100vh-2rem))]"
      aria-labelledby="homepage-preview-title"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
        <div>
          <h2 id="homepage-preview-title" className="text-base font-semibold text-zinc-900">
            Taslak önizleme
          </h2>
          <p className="text-xs text-zinc-500">
            Yalnızca editör oturumunda — canlı site değişmez.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Kapat
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <HomepageBuilderComposition
          builder={builder}
          selectedSlotKey={null}
          pendingSlotKey={null}
          onSelectSlot={() => {}}
          onClearSlot={() => {}}
          onMoveFeatured={() => {}}
          disabled
        />
      </div>
    </dialog>
  );
}

type ConflictBannerProps = {
  message: string;
  onReload: () => void;
};

export function HomepageConflictBanner({ message, onReload }: ConflictBannerProps) {
  return (
    <div
      className="border-b border-amber-200 bg-amber-50 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-amber-900">{message}</p>
      <button
        type="button"
        onClick={onReload}
        className="mt-2 rounded border border-amber-300 bg-white px-3 py-1 text-sm text-amber-900 hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      >
        Güncel taslağı yükle
      </button>
    </div>
  );
}
