"use client";

import type { NewsroomView, NewsroomViewCounts } from "@magazine/domain";
import {
  NEWSROOM_VIEW_LABELS,
  NEWSROOM_VIEW_TABS,
  newsroomViewCount,
} from "@/lib/content/newsroom-presentation";

type Props = {
  activeView: NewsroomView;
  counts: NewsroomViewCounts;
  onSelect: (view: NewsroomView) => void;
  isPending: boolean;
};

export function NewsroomViewTabs({
  activeView,
  counts,
  onSelect,
  isPending,
}: Props) {
  return (
    <nav
      aria-label="Haber masası görünümleri"
      className={`border-b border-zinc-200 ${isPending ? "opacity-60" : ""}`}
    >
      <div className="-mb-px flex gap-1 overflow-x-auto">
        {NEWSROOM_VIEW_TABS.map((view) => {
          const active = view === activeView;
          const count = newsroomViewCount(view, counts);
          return (
            <button
              key={view}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(view)}
              className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
              }`}
            >
              {NEWSROOM_VIEW_LABELS[view]}
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-normal ${
                  active ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
