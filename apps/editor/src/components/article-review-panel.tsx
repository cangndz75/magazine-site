import { formatDateTime } from "@/lib/content/format-date";
import { REVIEW_EVENT_LABELS } from "@/lib/content/revision-presentation";

export type ReviewHistoryItem = {
  id: string;
  contentVersionId: string;
  eventType: "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED";
  actorDisplayName: string;
  note: string | null;
  createdAt: string;
};

export function ArticleReviewPanel({
  events,
  awaitingReview,
}: {
  events: ReviewHistoryItem[];
  awaitingReview: boolean;
}) {
  return (
    <section aria-labelledby="review-status-heading">
      <h2 id="review-status-heading" className="text-sm font-semibold text-zinc-900">
        İnceleme
      </h2>
      {awaitingReview ? (
        <p className="mt-1 text-sm text-zinc-700">Bu sürüm inceleme bekliyor.</p>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">İnceleme geçmişi.</p>
      )}

      {events.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">İnceleme kaydı yok.</p>
      ) : (
        <ol className="mt-3 space-y-3">
          {events.map((event) => (
            <li key={event.id} className="text-sm">
              <p className="font-medium text-zinc-900">
                {REVIEW_EVENT_LABELS[event.eventType]}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {event.actorDisplayName} ·{" "}
                <time dateTime={event.createdAt}>
                  {formatDateTime(event.createdAt)}
                </time>
              </p>
              {event.note && (
                <p className="mt-1 text-xs text-zinc-600">{event.note}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
