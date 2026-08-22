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
      className={`rounded border border-zinc-200 bg-white p-1 shadow-sm shadow-zinc-200/40 ${
        isPending ? "opacity-60" : ""
      }`}
    >
      <div className="flex gap-1 overflow-x-auto">
        {NEWSROOM_VIEW_TABS.map((view) => {
          const active = view === activeView;
          const count = newsroomViewCount(view, counts);
          return (
            <button
              key={view}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onSelect(view)}
              className={`inline-flex h-10 shrink-0 items-center gap-2 rounded px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700 ${
                active
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              }`}
            >
              {NEWSROOM_VIEW_LABELS[view]}
              <span
                className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                  active ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-600"
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
