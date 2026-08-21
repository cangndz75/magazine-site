"use client";

import { formatDateTime } from "@/lib/content/format-date";

export type StaffSecurityAuditItem = {
  id: string;
  eventLabel: string;
  actorLabel: string;
  occurredAt: string;
  summary: string | null;
};

type Props = {
  items: StaffSecurityAuditItem[];
};

export function StaffSecurityAuditTimeline({ items }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Henüz güvenlik denetim kaydı yok.
      </p>
    );
  }

  return (
    <ol className="space-y-3" aria-label="Güvenlik denetim geçmişi">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded border border-zinc-200 bg-white px-3 py-2.5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-zinc-900">
              {item.eventLabel}
            </span>
            <time
              className="text-xs text-zinc-500"
              dateTime={item.occurredAt}
            >
              {formatDateTime(item.occurredAt)}
            </time>
          </div>
          <p className="mt-1 text-xs text-zinc-600">
            İşlemi yapan: {item.actorLabel}
          </p>
          {item.summary && (
            <p className="mt-1 text-xs text-zinc-500">{item.summary}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
