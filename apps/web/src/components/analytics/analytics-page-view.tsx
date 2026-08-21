"use client";

import { useEffect } from "react";
import {
  browserNavigationGeneration,
  claimPageViewOnce,
} from "@/lib/analytics/page-view-lifecycle";
import { publicAnalytics } from "@/lib/analytics/track";

export function AnalyticsArticleView({
  contentItemId,
  publicSlug,
  analyticsContext,
}: {
  contentItemId: string;
  publicSlug: string;
  analyticsContext: string;
}) {
  useEffect(() => {
    const key = `ARTICLE_VIEW:${contentItemId}:${browserNavigationGeneration()}`;
    if (!claimPageViewOnce(key)) {
      return;
    }
    publicAnalytics.trackArticleView({ contentItemId, publicSlug, analyticsContext });
  }, [analyticsContext, contentItemId, publicSlug]);

  return null;
}

export function AnalyticsHomepageView({
  homepageVersionId,
  analyticsContext,
}: {
  homepageVersionId: string | null;
  analyticsContext: string;
}) {
  useEffect(() => {
    const key = `HOMEPAGE_VIEW:${browserNavigationGeneration()}`;
    if (!claimPageViewOnce(key)) {
      return;
    }
    publicAnalytics.trackHomepageView({ homepageVersionId, analyticsContext });
  }, [analyticsContext, homepageVersionId]);

  return null;
}

export function AnalyticsWithdrawnPageView({
  contentItemId,
  publicSlug,
  withdrawalKind,
}: {
  contentItemId: string;
  publicSlug: string;
  withdrawalKind: "RETRACTION" | "TAKEDOWN";
}) {
  useEffect(() => {
    const key = `PAGE_VIEW:WITHDRAWN:${contentItemId}:${browserNavigationGeneration()}`;
    if (!claimPageViewOnce(key)) {
      return;
    }
    publicAnalytics.trackWithdrawnPageView({
      contentItemId,
      publicSlug,
      withdrawalKind,
    });
  }, [contentItemId, publicSlug, withdrawalKind]);

  return null;
}
