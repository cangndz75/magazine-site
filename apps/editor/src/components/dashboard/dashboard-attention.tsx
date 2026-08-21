import Link from "next/link";
import { NEWSROOM_VIEW } from "@magazine/domain";
import type { DashboardSection, SuperAdminAttentionItem } from "@magazine/db/editor";
import { DashboardSectionShell } from "./dashboard-section-shell";
import { StatusBadge } from "@/components/status-badge";
import {
  attentionSignalLabel,
  attentionSignalTone,
  formatDashboardRelative,
} from "@/lib/dashboard/dashboard-presentation";

const TONE_TO_VARIANT = {
  danger: "danger",
  warning: "warning",
  neutral: "neutral",
  success: "success",
  info: "info",
} as const;

export function DashboardAttention({
  section,
}: {
  section: DashboardSection<{ limit: number; total?: number; items: SuperAdminAttentionItem[] }>;
}) {
  return (
    <DashboardSectionShell
      title="Dikkat Gerektirenler"
      section={section}
      action={{ href: `/?view=${NEWSROOM_VIEW.ATTENTION}`, label: "Tümü" }}
      emptyWhen={(data) => data.items.length === 0}
      empty={
        <p className="py-2 text-sm text-zinc-500">
          Şu anda müdahale gerektiren kritik bir kayıt yok.
        </p>
      }
    >
      {(data) => (
        <ul className="divide-y divide-zinc-100">
          {data.items.map((item) => (
            <li key={`${item.contentItemId}:${item.signal}`} className="py-2.5">
              <Link href={item.targetHref} className="group block">
                <div className="flex items-center gap-2">
                  <StatusBadge
                    label={attentionSignalLabel(item.signal)}
                    variant={TONE_TO_VARIANT[attentionSignalTone(item.signal)]}
                  />
                  <span className="text-xs text-zinc-400">
                    {formatDashboardRelative(item.eventAt)}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-zinc-800 group-hover:text-zinc-950 group-hover:underline">
                  {item.title}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSectionShell>
  );
}
