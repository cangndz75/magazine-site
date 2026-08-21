import { formatAnalyticsCount, presentMetricAvailability } from "@/lib/analytics/presentation";
import type { AnalyticsOverviewDto } from "@/lib/analytics/types";

export function AnalyticsMediaEngagement({ overview }: { overview: AnalyticsOverviewDto }) {
  const videoPlaysReason = presentMetricAvailability(overview.metricAvailability.VIDEO_PLAYS);

  return (
    <section className="mb-6 rounded border border-zinc-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900">Medya Etkileşimi</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs text-zinc-500">Galeri Açılışı</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {formatAnalyticsCount(overview.metrics.galleryOpens)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Galeri Görsel Görüntüleme</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {formatAnalyticsCount(overview.metrics.galleryImageViews)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Video Gösterim</p>
          <p className="mt-1 text-lg font-semibold text-zinc-900">
            {formatAnalyticsCount(overview.metrics.videoImpressions)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Video Oynatma</p>
          <p className="mt-1 text-xs font-medium text-zinc-400">
            {videoPlaysReason ?? "Bu ölçüm henüz etkin değil."}
          </p>
        </div>
      </div>
    </section>
  );
}
