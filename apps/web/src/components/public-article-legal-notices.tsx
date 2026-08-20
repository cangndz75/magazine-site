import type { PublicLegalNotice } from "@magazine/domain";
import { formatPublicationDate } from "@/lib/format-publication-date";

type PublicArticleLegalNoticesProps = {
  notices: PublicLegalNotice[];
};

function noticeLabel(kind: PublicLegalNotice["kind"]): string {
  if (kind === "CORRECTION") {
    return "Düzeltme";
  }
  return "Açıklama";
}

export function PublicArticleLegalNotices({
  notices,
}: PublicArticleLegalNoticesProps) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <aside className="public-article-legal-notices" aria-label="Editöryal bildirimler">
      {notices.map((notice, index) => (
        <section
          key={`${notice.kind}:${notice.effectiveAt.toISOString()}:${index}`}
          className="public-article-legal-notice"
          data-legal-kind={notice.kind}
        >
          <p className="public-article-legal-notice__label">{noticeLabel(notice.kind)}</p>
          {notice.publicNote ? (
            <p className="public-article-legal-notice__text">{notice.publicNote}</p>
          ) : null}
          <p className="public-article-legal-notice__date">
            <time dateTime={notice.effectiveAt.toISOString()}>
              {formatPublicationDate(notice.effectiveAt)}
            </time>
          </p>
        </section>
      ))}
    </aside>
  );
}
