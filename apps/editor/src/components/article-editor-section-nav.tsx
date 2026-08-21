"use client";

import { useEffect, useState } from "react";
import { EDITOR_SECTION_NAV } from "@/lib/content/article-readiness-presentation";

type Props = {
  onNavigate: (targetId: string) => void;
};

export function ArticleEditorSectionNav({ onNavigate }: Props) {
  const [activeId, setActiveId] = useState<string>(EDITOR_SECTION_NAV[0]?.id ?? "");

  useEffect(() => {
    const sections = EDITOR_SECTION_NAV.map((item) =>
      document.getElementById(item.id),
    ).filter((item): item is HTMLElement => item !== null);

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActiveId(visible.target.id);
        }
      },
      {
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.1, 0.25, 0.5],
      },
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Editör bölümleri"
      className="sticky top-[4.75rem] z-10 -mx-1 mb-5 overflow-x-auto border-b border-zinc-200 bg-white/95 px-1 pb-2 pt-1 backdrop-blur sm:top-12"
    >
      <ul className="flex min-w-max gap-1">
        {EDITOR_SECTION_NAV.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-current={active ? "location" : undefined}
                onClick={() => {
                  onNavigate(item.id);
                  setActiveId(item.id);
                }}
                className={`rounded px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-500 ${
                  active
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
