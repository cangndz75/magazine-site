"use client";

import type { PresentedWorkflow } from "@/lib/content/workflow-eligibility";

type Props = {
  presented: PresentedWorkflow;
  publishedTitle?: string | null;
  draftTitle?: string | null;
  focusedTitle?: string | null;
  showVersionContext?: boolean;
};

export function ArticleEditorWorkflowBar({
  presented,
  publishedTitle,
  draftTitle,
  focusedTitle,
  showVersionContext = true,
}: Props) {
  return (
    <section
      aria-label="Yayın bağlamı"
      className="rounded border border-zinc-200 bg-zinc-50/80 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <ContextItem label="Yayın" value={presented.publicationLabel} />
        <ContextItem label="İş akışı" value={presented.workflowLabel} />
        <ContextItem label="Açık sürüm" value={presented.focusedVersionLabel} />
        {presented.scheduledLabel ? (
          <ContextItem label="Zamanlama" value={presented.scheduledLabel} />
        ) : null}
      </div>

      {showVersionContext ? (
        <div className="mt-3 grid gap-2 border-t border-zinc-200 pt-3 text-xs text-zinc-600 md:grid-cols-3">
          <VersionContext
            label="Yayındaki sürüm"
            version={presented.publishedVersionLabel}
            title={publishedTitle}
          />
          <VersionContext
            label="Çalışılan taslak"
            version={presented.draftVersionLabel}
            title={draftTitle}
          />
          <VersionContext
            label="Açık sürüm"
            version={presented.focusedVersionLabel}
            title={focusedTitle}
          />
        </div>
      ) : null}

      {presented.scheduledRepublishNotice ? (
        <p role="status" className="mt-3 text-sm text-amber-900">
          {presented.scheduledRepublishNotice}
        </p>
      ) : null}
    </section>
  );
}

function ContextItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-zinc-900">{value}</span>
    </div>
  );
}

function VersionContext({
  label,
  version,
  title,
}: {
  label: string;
  version: string;
  title?: string | null;
}) {
  return (
    <div>
      <p className="font-medium text-zinc-700">{label}</p>
      <p className="mt-0.5 text-zinc-900">{version}</p>
      {title ? <p className="mt-0.5 truncate text-zinc-500">{title}</p> : null}
    </div>
  );
}
