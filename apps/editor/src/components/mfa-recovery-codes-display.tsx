"use client";

import { useId, useState } from "react";
import {
  buildRecoveryCodesDownloadFilename,
  formatRecoveryCodesForCopy,
} from "@/lib/auth/mfa-presentation";

type MfaRecoveryCodesDisplayProps = {
  codes: string[];
  title: string;
  description: string;
  onAcknowledged: () => void;
  acknowledgeLabel?: string;
};

export function MfaRecoveryCodesDisplay({
  codes,
  title,
  description,
  onAcknowledged,
  acknowledgeLabel = "Kodları güvenli bir yere kaydettim",
}: MfaRecoveryCodesDisplayProps) {
  const listId = useId();
  const checkboxId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  async function handleCopyAll() {
    try {
      await navigator.clipboard.writeText(formatRecoveryCodesForCopy(codes));
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  function handleDownload() {
    const blob = new Blob([`${formatRecoveryCodesForCopy(codes)}\n`], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildRecoveryCodesDownloadFilename();
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-5" aria-labelledby={listId}>
      <div>
        <h2 id={listId} className="text-xl font-semibold text-zinc-950">
          {title}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">{description}</p>
      </div>

      <div
        className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        role="status"
      >
        Bu kodlar yalnızca bir kez gösterilir. Kapattıktan sonra tekrar görüntülenemezler.
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {codes.map((code) => (
          <li
            key={code}
            className="rounded border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900"
          >
            {code}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          onClick={() => void handleCopyAll()}
        >
          Tümünü kopyala
        </button>
        <button
          type="button"
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
          onClick={handleDownload}
        >
          Metin dosyası indir
        </button>
      </div>

      {copyState === "copied" ? (
        <p className="text-sm text-zinc-600" role="status">
          Kodlar panoya kopyalandı.
        </p>
      ) : null}
      {copyState === "failed" ? (
        <p className="text-sm text-zinc-700" role="alert">
          Kopyalama başarısız oldu. Kodları elle kaydedin.
        </p>
      ) : null}

      <label htmlFor={checkboxId} className="flex items-start gap-3 text-sm text-zinc-700">
        <input
          id={checkboxId}
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-zinc-300"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />
        <span>{acknowledgeLabel}</span>
      </label>

      <button
        type="button"
        className="w-full bg-zinc-950 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        disabled={!acknowledged}
        onClick={onAcknowledged}
      >
        Devam et
      </button>
    </section>
  );
}
