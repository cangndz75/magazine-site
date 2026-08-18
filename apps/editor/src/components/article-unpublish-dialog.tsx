"use client";

import { useEffect, useId, useRef } from "react";
import {
  UNPUBLISH_ACTION_LABEL,
  UNPUBLISH_EFFECT_COPY,
} from "@/lib/content/workflow-eligibility";

type Props = {
  open: boolean;
  pending: boolean;
  scheduleWarning: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ArticleUnpublishDialog({
  open,
  pending,
  scheduleWarning,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          onCancel();
        }
      }}
      className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white p-5 text-zinc-900 shadow-lg backdrop:bg-zinc-950/40"
    >
      <h2 id={titleId} className="text-base font-semibold">
        {UNPUBLISH_ACTION_LABEL}
      </h2>
      <p id={descriptionId} className="mt-2 text-sm text-zinc-700">
        {UNPUBLISH_EFFECT_COPY}
      </p>
      {scheduleWarning && (
        <p className="mt-2 text-sm text-amber-800">{scheduleWarning}</p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onCancel}
          className="h-9 rounded px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-400"
        >
          Vazgeç
        </button>
        <button
          type="button"
          disabled={pending}
          aria-label={UNPUBLISH_ACTION_LABEL}
          onClick={onConfirm}
          className="h-9 rounded border border-red-800 px-3 text-sm font-medium text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-700 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
        >
          {pending ? "İşleniyor…" : UNPUBLISH_ACTION_LABEL}
        </button>
      </div>
    </dialog>
  );
}
