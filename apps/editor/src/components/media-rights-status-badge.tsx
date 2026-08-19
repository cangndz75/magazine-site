import {
  MEDIA_RIGHTS_STATUS,
  type MediaRightsStatus,
} from "@magazine/domain";
import {
  RIGHTS_STATUS_PRESENTATION,
  type RightsStatusPresentation,
} from "@/lib/media/presentation";

type MediaRightsStatusBadgeProps = {
  status: MediaRightsStatus;
  eligible: boolean;
  compact?: boolean;
};

export function MediaRightsStatusBadge({
  status,
  eligible,
  compact = false,
}: MediaRightsStatusBadgeProps) {
  const presentation: RightsStatusPresentation =
    RIGHTS_STATUS_PRESENTATION[status] ??
    RIGHTS_STATUS_PRESENTATION[MEDIA_RIGHTS_STATUS.INCOMPLETE];

  const toneClasses: Record<RightsStatusPresentation["tone"], string> = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-rose-200 bg-rose-50 text-rose-950",
    muted: "border-zinc-200 bg-zinc-100 text-zinc-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${toneClasses[presentation.tone]} ${compact ? "max-w-full" : ""}`}
      title={eligible ? "Yayına uygun" : "Yayına uygun değil"}
    >
      <span aria-hidden="true">{presentation.icon}</span>
      <span className="truncate">{presentation.label}</span>
    </span>
  );
}
