"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import type { AnalyticsPlacement } from "@magazine/domain/analytics-client";
import {
  homepageImpressionKey,
  observeAnalyticsImpression,
} from "@/lib/analytics/impression";
import { publicAnalytics } from "@/lib/analytics/track";
import { useHomepageAnalytics } from "./homepage-analytics-context";

type AnalyticsHomepagePlacementProps = {
  contentItemId: string;
  placement: AnalyticsPlacement;
  position: number;
  analyticsContext: string;
  children: ReactNode;
};

function isTrustedLinkActivation(event: MouseEvent): boolean {
  if (!event.isTrusted) {
    return false;
  }
  const target = event.target;
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest("a") !== null;
}

export function AnalyticsHomepagePlacement({
  contentItemId,
  placement,
  position,
  analyticsContext,
  children,
}: AnalyticsHomepagePlacementProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const context = useHomepageAnalytics();

  useEffect(() => {
    const element = rootRef.current;
    if (!element || !context) {
      return;
    }
    return observeAnalyticsImpression({
      element,
      identity: homepageImpressionKey({
        pageViewContextId: context.pageViewContextId,
        placement,
        position,
        contentItemId,
      }),
      onImpressed: () => {
        publicAnalytics.trackHomepageImpression({
          contentItemId,
          placement,
          position,
          pageViewContextId: context.pageViewContextId,
          analyticsContext,
          ...(context.homepageVersionId
            ? { homepageVersionId: context.homepageVersionId }
            : {}),
        });
      },
    });
  }, [analyticsContext, contentItemId, context, placement, position]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    if (!context || !isTrustedLinkActivation(event)) {
      return;
    }
    publicAnalytics.trackHomepageClick({
      contentItemId,
      placement,
      position,
      pageViewContextId: context.pageViewContextId,
      analyticsContext,
      ...(context.homepageVersionId
        ? { homepageVersionId: context.homepageVersionId }
        : {}),
    });
  }

  return (
    <div ref={rootRef} onClick={handleClick}>
      {children}
    </div>
  );
}
