import type { ReactNode } from "react";
import Link from "next/link";
import type { DashboardSection } from "@magazine/db/editor";
import { DASHBOARD_UNAVAILABLE_COPY } from "@/lib/dashboard/dashboard-presentation";

type Props<T> = {
  title: string;
  section: DashboardSection<T>;
  action?: { href: string; label: string };
  children: (data: T) => ReactNode;
  emptyWhen?: (data: T) => boolean;
  empty?: ReactNode;
};

/**
 * Shared AVAILABLE/UNAVAILABLE envelope renderer for every dashboard card.
 * Never renders a live section as a numeric zero when its source failed.
 */
export function DashboardSectionShell<T>({
  title,
  section,
  action,
  children,
  emptyWhen,
  empty,
}: Props<T>) {
  return (
    <section className="border border-zinc-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-2.5">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-500">
          {title}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="text-xs font-medium text-pink-700 hover:text-pink-800 hover:underline"
          >
            {action.label} →
          </Link>
        )}
      </div>
      <div className="px-4 py-3">
        {section.status === "AVAILABLE" ? (
          empty && emptyWhen?.(section.data) ? (
            empty
          ) : (
            children(section.data)
          )
        ) : (
          <p className="py-2 text-sm text-zinc-500" role="status">
            {DASHBOARD_UNAVAILABLE_COPY}
          </p>
        )}
      </div>
    </section>
  );
}
