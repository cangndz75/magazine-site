"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  findActiveWorkspaceHref,
  type WorkspaceNavigationGroup,
} from "@/lib/workspace/navigation";
import { EditorGlobalSearch } from "@/components/editor-global-search";

type Props = {
  children: React.ReactNode;
  groups: WorkspaceNavigationGroup[];
  displayName: string;
  roleLabels: string[];
};

export function EditorAppShell({
  children,
  groups,
  displayName,
  roleLabels,
}: Props) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeHref = findActiveWorkspaceHref(pathname, groups);
  const activeItem =
    groups.flatMap((group) => group.items).find((item) => item.href === activeHref) ??
    groups[0]?.items[0] ??
    null;

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f4ef] text-zinc-950">
      <a
        href="#editor-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-zinc-950 focus:shadow"
      >
        İçeriğe geç
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-zinc-200 bg-zinc-950 text-white lg:flex lg:flex-col">
        <ShellSidebar
          groups={groups}
          activeHref={activeHref}
          displayName={displayName}
          roleLabels={roleLabels}
        />
      </aside>

      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Magazin
            </p>
            <p className="truncate text-sm font-semibold text-zinc-950">
              {activeItem?.label ?? "Editör"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="editor-mobile-navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-300 text-lg leading-none text-zinc-800 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
          >
            <span className="sr-only">Menüyü aç</span>
            ☰
          </button>
        </div>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            id="editor-mobile-navigation"
            className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col bg-zinc-950 text-white shadow-2xl"
          >
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                Magazin
              </span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded text-xl text-zinc-300 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span className="sr-only">Menüyü kapat</span>
                ×
              </button>
            </div>
            <ShellSidebar
              groups={groups}
              activeHref={activeHref}
              displayName={displayName}
              roleLabels={roleLabels}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[264px]">
        <main id="editor-content" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

function ShellSidebar({
  groups,
  activeHref,
  displayName,
  roleLabels,
  onNavigate,
}: {
  groups: WorkspaceNavigationGroup[];
  activeHref: string;
  displayName: string;
  roleLabels: string[];
  onNavigate?: () => void;
}) {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
    .join("");

  return (
    <>
      <div className="border-b border-white/10 px-5 py-5">
        <Link
          href="/"
          onClick={onNavigate}
          className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-white"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded bg-white text-xs text-zinc-950">
            M
          </span>
          Magazin
        </Link>
        <p className="mt-3 text-xs leading-5 text-zinc-400">
          Haber üretimi, medya varlıkları ve yayın akışı.
        </p>
      </div>

      <EditorGlobalSearch />

      <nav
        aria-label="Ana menü"
        className="flex-1 space-y-5 overflow-y-auto px-3 py-5"
      >
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              {group.label}
            </p>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group flex min-h-12 items-center gap-3 rounded px-2.5 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                      active
                        ? "bg-white text-zinc-950"
                        : "text-zinc-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-[11px] font-semibold ${
                        active
                          ? "bg-zinc-950 text-white"
                          : "bg-white/10 text-zinc-300 group-hover:bg-white/15 group-hover:text-white"
                      }`}
                    >
                      {item.marker}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{item.label}</span>
                      <span
                        className={`block truncate text-xs ${
                          active ? "text-zinc-500" : "text-zinc-500"
                        }`}
                      >
                        {item.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white/10 text-xs font-semibold text-white">
            {initials || "ED"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            <p className="truncate text-xs text-zinc-500">
              {roleLabels.join(", ")}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Link
            href="/settings/security"
            className="inline-flex h-8 items-center rounded border border-white/10 px-2.5 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            Güvenlik
          </Link>
          <form method="post" action="/api/auth/logout">
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded px-2.5 text-xs font-medium text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              Çıkış
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
