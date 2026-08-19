"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { VIDEO_ERROR, VIDEO_TEXT_MAX } from "@magazine/domain";
import { presentVideoUrlError } from "@/lib/video/presentation";

function presentClientVideoUrlInputError(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return "Video bağlantısı gerekli.";
  }
  const lowered = trimmed.toLowerCase();
  if (
    trimmed.includes("<") ||
    trimmed.includes(">") ||
    lowered.startsWith("javascript:") ||
    lowered.startsWith("data:")
  ) {
    return presentVideoUrlError(VIDEO_ERROR.INVALID_VIDEO_URL, trimmed);
  }
  return null;
}

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

type VideoAddDialogProps = {
  open: boolean;
  disabled: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function VideoAddDialog({
  open,
  disabled,
  onClose,
  onCreated,
}: VideoAddDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const urlId = useId();
  const titleId = useId();
  const errorId = useId();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      setUrl("");
      setTitle("");
      setError(null);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (disabled || busy) {
      return;
    }
    const clientUrlError = presentClientVideoUrlInputError(url);
    if (clientUrlError) {
      setError(clientUrlError);
      return;
    }
    if (title.trim().length === 0) {
      setError("Başlık gerekli.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerUrlOrId: url.trim(),
          title: title.trim(),
        }),
      });
      const raw = await response.text();
      const payload = (raw ? JSON.parse(raw) : {}) as ApiEnvelope<{ id: string }>;
      if (!response.ok || payload.ok === false || !payload.data) {
        setError(
          presentVideoUrlError(payload.error?.code ?? "", url),
        );
        return;
      }
      onCreated(payload.data.id);
      onClose();
    } catch {
      setError("Video eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="video-add-title"
      aria-describedby={error ? errorId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!disabled && !busy) {
          onClose();
        }
      }}
      className="w-[min(32rem,calc(100vw-1.5rem))] rounded-lg border border-zinc-200 bg-white p-0 text-zinc-900 shadow-lg backdrop:bg-zinc-950/40"
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4 p-4">
        <div>
          <h2 id="video-add-title" className="text-base font-semibold">
            Video ekle
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            YouTube veya Vimeo bağlantısı yapıştırın. Embed HTML kabul edilmez.
            Başlık sağlayıcıdan çekilmez; siz yazarsınız.
          </p>
        </div>
        <div>
          <label htmlFor={urlId} className="mb-1 block text-sm font-medium">
            Video bağlantısı
          </label>
          <input
            id={urlId}
            type="text"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            autoComplete="off"
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor={titleId} className="mb-1 block text-sm font-medium">
            Başlık
          </label>
          <input
            id={titleId}
            type="text"
            maxLength={VIDEO_TEXT_MAX.TITLE}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        {error ? (
          <p id={errorId} className="text-sm text-rose-700" role="alert">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-9 rounded px-3 text-sm text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={disabled || busy}
            className="h-9 rounded bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 disabled:opacity-50"
          >
            {busy ? "Ekleniyor…" : "Ekle"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
