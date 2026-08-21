"use client";

import { useEffect, useState } from "react";
import {
  formatDateTime,
  formatRelativeDate,
} from "@/lib/content/format-date";

type Props = {
  iso: string;
  className?: string;
};

/**
 * Relative labels depend on the current clock and must not render during SSR.
 * The server renders a stable absolute editorial timestamp instead.
 */
export function RelativeTime({ iso, className }: Props) {
  const [relative, setRelative] = useState<string | null>(null);
  const absolute = formatDateTime(iso);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRelative(formatRelativeDate(iso));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [iso]);

  return (
    <time dateTime={iso} className={className} title={absolute}>
      {relative ?? absolute}
    </time>
  );
}
