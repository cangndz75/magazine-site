"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  ANALYTICS_PLACEMENT,
  type AnalyticsPlacement,
} from "@magazine/domain/analytics-client";
import {
  observeAnalyticsImpression,
  videoImpressionKey,
} from "@/lib/analytics/impression";
import {
  browserNavigationGeneration,
  pageViewContextIdFor,
} from "@/lib/analytics/page-view-lifecycle";
import { publicAnalytics } from "@/lib/analytics/track";
import { useHomepageAnalytics } from "./homepage-analytics-context";

type AnalyticsVideoImpressionProps = {
  videoAssetId: string;
  placement:
    | typeof ANALYTICS_PLACEMENT.ARTICLE_VIDEO
    | typeof ANALYTICS_PLACEMENT.HOMEPAGE_VIDEO;
  contentItemId?: string;
  homepageVersionId?: string;
  analyticsContext: string;
  children: ReactNode;
};

function createContextId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000002";
}

export function AnalyticsVideoImpression({
  videoAssetId,
  placement,
  contentItemId,
  homepageVersionId,
  analyticsContext,
  children,
}: AnalyticsVideoImpressionProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const homepage = useHomepageAnalytics();

  useEffect(() => {
    const element = rootRef.current;
    if (!element) {
      return;
    }
    const pageViewContextId =
      homepage?.pageViewContextId ??
      pageViewContextIdFor(
        `video:${browserNavigationGeneration()}`,
        createContextId,
      );
    const resolvedHomepageVersionId =
      homepageVersionId ?? homepage?.homepageVersionId ?? undefined;

    return observeAnalyticsImpression({
      element,
      identity: videoImpressionKey({
        pageViewContextId,
        placement: placement as AnalyticsPlacement,
        videoAssetId,
      }),
      onImpressed: () => {
        publicAnalytics.trackVideoImpression({
          videoAssetId,
          placement,
          analyticsContext,
          ...(contentItemId ? { contentItemId } : {}),
          ...(resolvedHomepageVersionId
            ? { homepageVersionId: resolvedHomepageVersionId }
            : {}),
        });
      },
    });
  }, [analyticsContext, contentItemId, homepage, homepageVersionId, placement, videoAssetId]);

  return <div ref={rootRef}>{children}</div>;
}
