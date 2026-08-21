import { formatDashboardDateTime } from "@/lib/dashboard/dashboard-presentation";

export function DashboardHeader({ generatedAt }: { generatedAt: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Kontrol Merkezi</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Yayın, ekip, risk ve performans görünümü
        </p>
      </div>
      <p className="text-xs text-zinc-400">
        Üretilme zamanı: {formatDashboardDateTime(generatedAt)}
      </p>
    </div>
  );
}
