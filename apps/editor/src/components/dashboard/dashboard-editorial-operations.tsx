import Link from "next/link";
import type { SuperAdminEditorialSummary } from "@magazine/db/editor";
import { DashboardSectionShell } from "./dashboard-section-shell";
import { formatDashboardCount } from "@/lib/dashboard/dashboard-presentation";
import type { DashboardSection } from "@magazine/db/editor";

type Row = {
  key: keyof SuperAdminEditorialSummary;
  label: string;
  href: string;
  tone: "neutral" | "warning";
};

const ROWS: Row[] = [
  { key: "draft", label: "Taslaklar", href: "/?view=DRAFTS", tone: "neutral" },
  { key: "inReview", label: "İncelemede", href: "/?view=IN_REVIEW", tone: "neutral" },
  { key: "approved", label: "Onaylandı", href: "/?workflowStatus=APPROVED", tone: "neutral" },
  {
    key: "changesRequested",
    label: "Değişiklik İstendi",
    href: "/?view=ATTENTION",
    tone: "warning",
  },
  { key: "scheduled", label: "Zamanlandı", href: "/?view=SCHEDULED", tone: "neutral" },
  { key: "published", label: "Yayında", href: "/?view=PUBLISHED", tone: "neutral" },
];

export function DashboardEditorialOperations({
  section,
}: {
  section: DashboardSection<SuperAdminEditorialSummary>;
}) {
  return (
    <DashboardSectionShell title="Yayın Operasyonu" section={section} action={{ href: "/", label: "Haber Masası" }}>
      {(data) => {
        const max = Math.max(1, ...ROWS.map((row) => data[row.key]));
        return (
          <ul className="space-y-2.5">
            {ROWS.map((row) => {
              const value = data[row.key];
              const width = Math.max((value / max) * 100, value > 0 ? 3 : 0);
              return (
                <li key={row.key}>
                  <Link
                    href={row.href}
                    className="group flex items-center gap-3 rounded px-1 py-0.5 hover:bg-zinc-50"
                  >
                    <span className="w-36 shrink-0 text-sm text-zinc-700 group-hover:text-zinc-950">
                      {row.label}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <span
                        className={`block h-full rounded-full ${
                          row.tone === "warning" ? "bg-amber-500" : "bg-pink-600"
                        }`}
                        style={{ width: `${width}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-950">
                      {formatDashboardCount(value)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        );
      }}
    </DashboardSectionShell>
  );
}
