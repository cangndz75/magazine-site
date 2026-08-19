"use client";

import { useId, useRef, useState } from "react";
import {
  MEDIA_IMAGE_MAX_BYTES,
} from "@magazine/domain";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,.jpg,.jpeg,.png,.webp,.avif";
const MAX_MB = Math.round(MEDIA_IMAGE_MAX_BYTES / (1024 * 1024));

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string };
};

type UploadResult = {
  id: string;
  label: string;
};

type MediaUploadDialogProps = {
  open: boolean;
  onClose: () => void;
  onUploaded: (item: UploadResult) => void;
};

export function MediaUploadDialog({
  open,
  onClose,
  onUploaded,
}: MediaUploadDialogProps) {
  const inputId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  function reset() {
    setFile(null);
    setState("idle");
    setError(null);
    setDragOver(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function close() {
    if (state === "uploading") {
      return;
    }
    reset();
    onClose();
  }

  function takeFile(next: File | null) {
    setFile(next);
    setState("idle");
    setError(null);
  }

  async function upload() {
    if (!file) {
      setError("Bir görsel seçin.");
      setState("error");
      return;
    }
    setState("uploading");
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/media/upload", {
        method: "POST",
        body,
      });
      const raw = await response.text();
      const payload = (raw ? JSON.parse(raw) : {}) as ApiEnvelope<UploadResult>;
      if (!response.ok || payload.ok === false || !payload.data) {
        throw new Error(payload.error?.message ?? "Yükleme başarısız.");
      }
      setState("success");
      onUploaded(payload.data);
      reset();
      onClose();
    } catch (caught) {
      setState("error");
      setError(caught instanceof Error ? caught.message : "Yükleme başarısız.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="presentation"
      onClick={close}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-lg sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-upload-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="media-upload-title" className="text-lg font-semibold">
            Medya yükle
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={state === "uploading"}
            className="rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50"
          >
            Kapat
          </button>
        </div>
        <p className="mt-2 text-sm text-zinc-600">
          JPEG, PNG, WebP veya AVIF. En fazla {MAX_MB} MB. SVG ve video kabul edilmez.
        </p>

        <div
          className={`mt-4 rounded-lg border border-dashed px-3 py-6 text-center ${
            dragOver ? "border-zinc-900 bg-zinc-50" : "border-zinc-300"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            const dropped = event.dataTransfer.files.item(0);
            takeFile(dropped);
          }}
        >
          <label htmlFor={inputId} className="block cursor-pointer">
            <span className="text-sm font-medium text-zinc-900">Dosya seçin</span>
            <span className="mt-1 block text-xs text-zinc-500">
              veya buraya bırakın
            </span>
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(event) => takeFile(event.target.files?.item(0) ?? null)}
          />
          {file ? (
            <p className="mt-3 truncate text-sm text-zinc-700">{file.name}</p>
          ) : null}
        </div>

        <p id={statusId} className="mt-3 min-h-[1.25rem] text-sm" role="status" aria-live="polite">
          {state === "uploading" ? "Yükleniyor…" : null}
          {state === "success" ? "Yüklendi." : null}
          {state === "error" && error ? (
            <span className="text-rose-700">{error}</span>
          ) : null}
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            disabled={state === "uploading"}
            className="rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={() => void upload()}
            disabled={state === "uploading" || !file}
            className="rounded bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:opacity-50"
          >
            {state === "uploading" ? "Yükleniyor…" : "Yükle"}
          </button>
        </div>
      </div>
    </div>
  );
}
