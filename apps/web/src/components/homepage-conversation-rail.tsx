import Image from "next/image";
import Link from "next/link";
import type { PublicHomepageConversationItem } from "@magazine/db/public";
import { env } from "@/lib/env";

type HomepageConversationRailProps = {
  items: PublicHomepageConversationItem[];
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

export function HomepageConversationRail({ items }: HomepageConversationRailProps) {
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
            return (
              <li key={item.rank} className="homepage-conversation-rail__item">
                <Link
                  href={`/${item.article.slug}`}
                  className="homepage-conversation-rail__link"
                  aria-label={accessibleName}
                >
                  <ConversationRow item={item} />
                </Link>
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
