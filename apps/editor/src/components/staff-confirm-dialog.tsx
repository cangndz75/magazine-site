"use client";

import { useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  pending: boolean;
  title: string;
  description: string;
  warning?: string | null;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function StaffConfirmDialog({
  open,
  pending,
  title,
  description,
  warning,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const warningId = useId();

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
      aria-describedby={warning ? `${descriptionId} ${warningId}` : descriptionId}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) {
          onCancel();
        }
      }}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-zinc-200 bg-white p-5 text-zinc-900 shadow-lg backdrop:bg-zinc-950/40"
    >
      <h2 id={titleId} className="text-base font-semibold">
        {title}
      </h2>
      <p id={descriptionId} className="mt-2 text-sm text-zinc-700">
        {description}
      </p>
      {warning && (
        <p
          id={warningId}
          role="alert"
          className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {warning}
        </p>
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
          aria-label={confirmLabel}
          onClick={onConfirm}
          className={
            destructive
              ? "h-9 rounded border border-red-800 px-3 text-sm font-medium text-red-800 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-700 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"
              : "h-9 rounded border border-zinc-800 bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-600 disabled:cursor-not-allowed disabled:bg-zinc-300"
          }
        >
          {pending ? "İşleniyor…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
