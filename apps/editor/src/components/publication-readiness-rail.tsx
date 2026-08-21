"use client";

import type { ArticleReadinessDTO, ReadinessSectionId } from "@magazine/domain";
import {
  presentReadinessSectionState,
  presentReadinessSummary,
  READINESS_SECTION_LABELS,
  READINESS_SECTION_TARGETS,
} from "@/lib/content/article-readiness-presentation";

type Props = {
  readiness: ArticleReadinessDTO;
  onNavigate?: (targetId: string) => void;
  compact?: boolean;
};

export function PublicationReadinessRail({
  readiness,
  onNavigate,
  compact = false,
}: Props) {
  const summary = presentReadinessSummary(readiness);

  function handleIssueClick(targetSection: ReadinessSectionId) {
    const targetId = READINESS_SECTION_TARGETS[targetSection];
    onNavigate?.(targetId);
  }

  return (
    <section
      aria-labelledby="publication-readiness-heading"
      className="rounded border border-zinc-200 bg-white"
    >
      <div className="border-b border-zinc-200 px-4 py-3">
        <h2
          id="publication-readiness-heading"
          className="text-sm font-semibold text-zinc-900"
        >
          Yayın hazırlığı
        </h2>
        <p className="mt-1 text-sm text-zinc-700" aria-live="polite">
          {summary}
        </p>
      </div>

      <ul className="divide-y divide-zinc-100">
        {readiness.sections.map((section) => (
          <li key={section.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900">
                  {READINESS_SECTION_LABELS[section.id]}
                </p>
                {!compact && section.issues.length > 0 ? (
                  <ul className="mt-1 space-y-1">
                    {section.issues.slice(0, 3).map((item) => (
                      <li key={`${section.id}-${item.code}`}>
                        <button
                          type="button"
                          onClick={() => handleIssueClick(item.targetSection)}
                          className="text-left text-xs text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                    {section.issues.length > 3 ? (
                      <li className="text-xs text-zinc-500">
                        +{section.issues.length - 3} ek uyarı
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
              <ReadinessStateBadge state={section.state} />
            </div>
          </li>
        ))}
      </ul>

      {readiness.blockingIssues.length > 0 ? (
        <div className="border-t border-red-100 bg-red-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-red-800">
            Yayın engelleri
          </p>
          <ul className="mt-2 space-y-1">
            {readiness.blockingIssues.map((item) => (
              <li key={`blocker-${item.code}-${item.label}`}>
                <button
                  type="button"
                  onClick={() => handleIssueClick(item.targetSection)}
                  className="text-left text-sm text-red-900 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-red-700"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ReadinessStateBadge({
  state,
}: {
  state: ArticleReadinessDTO["sections"][number]["state"];
}) {
  const label = presentReadinessSectionState(state);
  const className =
    state === "READY"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : state === "BLOCKED"
        ? "bg-red-50 text-red-800 ring-red-200"
        : state === "NOT_APPLICABLE"
          ? "bg-zinc-50 text-zinc-500 ring-zinc-200"
          : "bg-amber-50 text-amber-900 ring-amber-200";

  return (
    <span
      className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}
