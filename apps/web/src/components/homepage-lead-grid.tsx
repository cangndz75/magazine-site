import type { PublicHomepage } from "@magazine/db/public";
import { HomepageConversationRail } from "@/components/homepage-conversation-rail";
import { HomepageLead } from "@/components/homepage-lead";
import { HomepageSupportStory } from "@/components/homepage-support-story";

type HomepageLeadGridProps = {
  homepage: PublicHomepage;
};

export function HomepageLeadGrid({ homepage }: HomepageLeadGridProps) {
  if (!homepage.lead) {
    return null;
  }

  const hasSupports = homepage.supports.length > 0;
  const hasConversation = homepage.conversation.length > 0;

  const className = [
    "homepage-lead-grid",
    hasSupports ? null : "homepage-lead-grid--solo",
    hasConversation ? "homepage-lead-grid--with-conversation" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="homepage-lead-grid__lead">
        <HomepageLead story={homepage.lead} />
      </div>
      {hasSupports ? (
        <div className="homepage-lead-grid__supports">
          {homepage.supports.map((story) => (
            <HomepageSupportStory key={story.id} story={story} />
          ))}
        </div>
      ) : null}
      {hasConversation ? (
        <div className="homepage-lead-grid__conversation">
          <HomepageConversationRail items={homepage.conversation} />
        </div>
      ) : null}
    </div>
  );
}
