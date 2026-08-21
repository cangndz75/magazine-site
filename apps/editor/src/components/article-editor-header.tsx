"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import {
  presentSaveState,
  presentSaveStateLabel,
} from "@/lib/content/article-readiness-presentation";
import {
  PUBLICATION_STATUS_LABELS,
  WORKFLOW_STATUS_LABELS,
} from "@/lib/content/revision-presentation";

type Props = {
  backHref: string;
  backLabel: string;
  title: string;
  slug: string;
  publicationStatus: keyof typeof PUBLICATION_STATUS_LABELS;
  workflowStatus: keyof typeof WORKFLOW_STATUS_LABELS | null;
  publicationVariant: "neutral" | "success" | "warning" | "info" | "danger";
  workflowVariant: "neutral" | "success" | "warning" | "info" | "danger";
  scheduledLabel: string | null;
  isDirty: boolean;
  isSaving: boolean;
  saveKind: "idle" | "saved" | "conflict" | "error";
  saveMessage?: string;
  onReload?: () => void;
};

export function ArticleEditorHeader({
  backHref,
  backLabel,
  title,
  slug,
  publicationStatus,
  workflowStatus,
  publicationVariant,
  workflowVariant,
  scheduledLabel,
  isDirty,
  isSaving,
  saveKind,
  saveMessage,
  onReload,
}: Props) {
  const saveState = presentSaveState({
    isDirty,
    isSaving,
    saveKind,
    saveMessage,
  });
  const saveLabel = presentSaveStateLabel(saveState);

  return (
    <header className="border-b border-zinc-200 pb-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="rounded px-2 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-500"
        >
          {backLabel}
        </Link>
        <div className="flex items-center gap-2">
          <SaveStateIndicator state={saveState} label={saveLabel} onReload={onReload} />
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-950 md:text-[1.75rem]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{slug}</p>
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="Yayın ve iş akışı durumu"
        >
          <span className="text-xs text-zinc-500">Yayın durumu</span>
          <StatusBadge
            label={PUBLICATION_STATUS_LABELS[publicationStatus]}
            variant={mapBadgeVariant(publicationVariant)}
          />
          <span className="text-xs text-zinc-500">İş akışı</span>
          <StatusBadge
            label={workflowStatus ? WORKFLOW_STATUS_LABELS[workflowStatus] : "—"}
            variant={mapBadgeVariant(workflowVariant)}
          />
          {scheduledLabel ? (
            <StatusBadge label={scheduledLabel} variant="info" />
          ) : null}
        </div>
      </div>
    </header>
  );
}

function mapBadgeVariant(
  variant: Props["publicationVariant"],
): "neutral" | "success" | "warning" | "info" {
  return variant === "danger" ? "warning" : variant;
}

function SaveStateIndicator({
  state,
  label,
  onReload,
}: {
  state: ReturnType<typeof presentSaveState>;
  label: string;
  onReload?: () => void;
}) {
  const tone =
    state.kind === "conflict" || state.kind === "error"
      ? "text-red-700"
      : state.kind === "dirty"
        ? "text-amber-800"
        : state.kind === "saving"
          ? "text-zinc-600"
          : state.kind === "saved"
            ? "text-emerald-700"
            : "text-zinc-600";

  return (
    <div className="flex items-center gap-2">
      <p className={`text-xs ${tone}`} aria-live="polite">
        {label}
      </p>
      {state.kind === "conflict" && onReload ? (
        <button
          type="button"
          onClick={onReload}
          className="text-xs font-medium text-red-800 underline hover:text-red-900"
        >
          Yenile
        </button>
      ) : null}
    </div>
  );
}
