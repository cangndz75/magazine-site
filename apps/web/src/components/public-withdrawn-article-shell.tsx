import type { PublicWithdrawnArticleShell } from "@magazine/domain";
import { PUBLIC_ARTICLE_WITHDRAWAL_KIND } from "@magazine/domain";
import { AnalyticsWithdrawnPageView } from "@/components/analytics/analytics-page-view";
import { formatPublicationDate } from "@/lib/format-publication-date";

type PublicWithdrawnArticleShellProps = {
  shell: PublicWithdrawnArticleShell;
};

function withdrawalLabel(
  withdrawalKind: PublicWithdrawnArticleShell["withdrawalKind"],
): string {
  if (withdrawalKind === PUBLIC_ARTICLE_WITHDRAWAL_KIND.TAKEDOWN) {
    return "Yayından kaldırıldı";
  }
  return "Geri çekildi";
}

function defaultWithdrawalText(
  withdrawalKind: PublicWithdrawnArticleShell["withdrawalKind"],
): string {
  if (withdrawalKind === PUBLIC_ARTICLE_WITHDRAWAL_KIND.TAKEDOWN) {
    return "Bu içerik yayından kaldırılmıştır.";
  }
  return "Bu yazı geri çekilmiştir.";
}

export function PublicWithdrawnArticleShellView({
  shell,
}: PublicWithdrawnArticleShellProps) {
  const noticeText = shell.publicNote?.trim() || defaultWithdrawalText(shell.withdrawalKind);

  return (
    <div className="public-article-page public-article-page--withdrawn">
      <AnalyticsWithdrawnPageView
        contentItemId={shell.id}
        publicSlug={shell.slug}
        withdrawalKind={shell.withdrawalKind}
      />
      <div className="public-article-page__text">
        <header className="article-header">
          <h1 className="article-header__title">{shell.title}</h1>
          <p className="article-header__meta">
            <time dateTime={shell.publishedAt.toISOString()}>
              {formatPublicationDate(shell.publishedAt)}
            </time>
          </p>
        </header>
      </div>

      <div className="public-article-page__body">
        <aside
          className="public-article-withdrawal-notice"
          aria-label={withdrawalLabel(shell.withdrawalKind)}
          data-withdrawal-kind={shell.withdrawalKind}
        >
          <p className="public-article-withdrawal-notice__label">
            {withdrawalLabel(shell.withdrawalKind)}
          </p>
          <p className="public-article-withdrawal-notice__text">{noticeText}</p>
          <p className="public-article-withdrawal-notice__date">
            <time dateTime={shell.effectiveAt.toISOString()}>
              {formatPublicationDate(shell.effectiveAt)}
            </time>
          </p>
        </aside>
      </div>
    </div>
  );
}
