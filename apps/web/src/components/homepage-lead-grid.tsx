import type { ReactNode } from "react";
import type { PublicHomepage } from "@magazine/db/public";
import { ANALYTICS_PLACEMENT } from "@magazine/domain/analytics-client";
import { AnalyticsHomepagePlacement } from "@/components/analytics/analytics-homepage-placement";
import { HomepageConversationRail } from "@/components/homepage-conversation-rail";
import { HomepageLead } from "@/components/homepage-lead";
import { HomepageSupportStory } from "@/components/homepage-support-story";
import { HomepageVideo } from "@/components/homepage-video";
import { findHomepagePlacement } from "@/lib/analytics/placements";

type HomepageLeadGridProps = {
  homepage: PublicHomepage;
};

export function HomepageLeadGrid({ homepage }: HomepageLeadGridProps) {
  if (!homepage.lead) {
    return null;
  }

  const hasSupports = homepage.supports.length > 0;
  const hasConversation = homepage.conversation.length > 0;
  const hasVideo = Boolean(homepage.video);
  const hasRail = hasConversation || hasVideo;

  const className = [
    "homepage-lead-grid",
    hasSupports ? null : "homepage-lead-grid--solo",
    hasRail ? "homepage-lead-grid--with-rail" : null,
    hasConversation ? "homepage-lead-grid--with-conversation" : null,
    hasVideo ? "homepage-lead-grid--with-rail-video" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className}>
      <div className="homepage-lead-grid__lead">
        {wrapPlacement(
          homepage.lead.id,
          undefined,
          <HomepageLead story={homepage.lead} />,
          homepage.analyticsPlacements,
        )}
      </div>
      {hasSupports ? (
        <div className="homepage-lead-grid__supports">
          {homepage.supports.map((story) => (
            <div key={story.id}>
              {wrapPlacement(
                story.id,
                undefined,
                <HomepageSupportStory story={story} />,
                homepage.analyticsPlacements,
              )}
            </div>
          ))}
        </div>
      ) : null}
      {hasRail ? (
        <div className="homepage-lead-grid__rail">
          {hasConversation ? (
            <HomepageConversationRail
              items={homepage.conversation}
              placements={homepage.analyticsPlacements}
            />
          ) : null}
          {homepage.video ? (
            <HomepageVideo
              video={homepage.video}
              homepageVersionId={homepage.homepageVersionId}
              analyticsContext={homepage.homepageVideoContext}
              variant="rail"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function wrapPlacement(
  contentItemId: string,
  placement: (typeof ANALYTICS_PLACEMENT)[keyof typeof ANALYTICS_PLACEMENT] | undefined,
  node: ReactNode,
  placements: PublicHomepage["analyticsPlacements"],
) {
  const found = placement
    ? findHomepagePlacement(placements, { contentItemId, placement })
    : placements.find(
        (item) =>
          item.contentItemId === contentItemId &&
          item.placement !== ANALYTICS_PLACEMENT.CONVERSATION,
      );
  if (!found?.analyticsContext) {
    return node;
  }
  return (
    <AnalyticsHomepagePlacement
      contentItemId={found.contentItemId}
      placement={found.placement}
      position={found.position}
      analyticsContext={found.analyticsContext}
    >
      {node}
    </AnalyticsHomepagePlacement>
  );
}
