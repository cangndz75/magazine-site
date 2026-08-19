"use client";

import Link from "next/link";
import type { EditorListCursor } from "@magazine/domain";

type Props = {
  nextCursor: string | null;
  currentCursor: EditorListCursor | { submittedAt: string; id: string } | null;
  firstPageHref: string;
  onNavigate: (cursor: string) => void;
  isPending: boolean;
};

export function ContentPagination({
  nextCursor,
  currentCursor,
  firstPageHref,
  onNavigate,
  isPending,
}: Props) {
  if (!nextCursor && !currentCursor) return null;

  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-xs text-zinc-500">
        {currentCursor && (
          <Link
            href={firstPageHref}
            className="text-zinc-600 underline hover:text-zinc-800"
          >
            ← Başa dön
          </Link>
        )}
      </div>
      <div>
        {nextCursor && (
          <button
            type="button"
            onClick={() => onNavigate(nextCursor)}
            disabled={isPending}
            className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Sonraki →
          </button>
        )}
      </div>
    </div>
  );
}
