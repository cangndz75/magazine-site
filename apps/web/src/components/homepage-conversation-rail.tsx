import Image from "next/image";
import Link from "next/link";
import type {
  PublicHomepageConversationItem,
  PublicHomepageAnalyticsPlacement,
} from "@magazine/db/public";
import { ANALYTICS_PLACEMENT } from "@magazine/domain/analytics-client";
import { AnalyticsHomepagePlacement } from "@/components/analytics/analytics-homepage-placement";
import { env } from "@/lib/env";
import { findHomepagePlacement } from "@/lib/analytics/placements";

type HomepageConversationRailProps = {
  items: PublicHomepageConversationItem[];
  placements?: readonly PublicHomepageAnalyticsPlacement[];
};

function formatRank(rank: number): string {
  return String(rank).padStart(2, "0");
}

function conversationAccessibleName(item: PublicHomepageConversationItem): string {
  if (item.reason) {
    return `${item.label}: ${item.reason}`;
  }
  return item.label;
}

type ConversationRowProps = {
  item: PublicHomepageConversationItem;
};

function ConversationRow({ item }: ConversationRowProps) {
  const hero = item.article?.hero;
  const useUnoptimizedImage = env.APP_ENV === "development";

  return (
    <>
      <span className="homepage-conversation-rail__rank">{formatRank(item.rank)}</span>
      <div className="homepage-conversation-rail__body">
        <p className="homepage-conversation-rail__label">{item.label}</p>
        {item.reason ? (
          <p className="homepage-conversation-rail__reason">{item.reason}</p>
        ) : null}
      </div>
      {hero ? (
        <Image
          src={hero.url}
          alt={hero.altText ?? item.label}
          width={40}
          height={40}
          className="homepage-conversation-rail__thumb"
          unoptimized={useUnoptimizedImage}
        />
      ) : null}
    </>
  );
}

export function HomepageConversationRail({
  items,
  placements = [],
}: HomepageConversationRailProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <aside className="homepage-conversation-rail" aria-label="Şu An Konuşuluyor">
      <header className="homepage-conversation-rail__header">
        <h2 className="homepage-conversation-rail__title">Şu An Konuşuluyor</h2>
      </header>
      <ol className="homepage-conversation-rail__list">
        {items.map((item) => {
          const accessibleName = conversationAccessibleName(item);

          if (item.article) {
            const placement = findHomepagePlacement(placements, {
              contentItemId: item.article.id,
              placement: ANALYTICS_PLACEMENT.CONVERSATION,
              position: item.rank,
            });
            const link = (
              <Link
                href={`/${item.article.slug}`}
                className="homepage-conversation-rail__link"
                aria-label={accessibleName}
              >
                <ConversationRow item={item} />
              </Link>
            );
            return (
              <li key={item.rank} className="homepage-conversation-rail__item">
                {placement?.analyticsContext ? (
                  <AnalyticsHomepagePlacement
                    contentItemId={placement.contentItemId}
                    placement={placement.placement}
                    position={placement.position}
                    analyticsContext={placement.analyticsContext}
                  >
                    {link}
                  </AnalyticsHomepagePlacement>
                ) : (
                  link
                )}
              </li>
            );
          }

          return (
            <li key={item.rank} className="homepage-conversation-rail__item">
              <div className="homepage-conversation-rail__static" aria-label={accessibleName}>
                <ConversationRow item={item} />
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
