"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  browserNavigationGeneration,
  pageViewContextIdFor,
} from "@/lib/analytics/page-view-lifecycle";

type HomepageAnalyticsValue = {
  homepageVersionId: string | null;
  pageViewContextId: string;
};

const HomepageAnalyticsContext = createContext<HomepageAnalyticsValue | null>(
  null,
);

function createContextId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000001";
}

function subscribe(): () => void {
  return () => undefined;
}

function getHomepagePageViewContextId(): string | null {
  return pageViewContextIdFor(
    `homepage:${browserNavigationGeneration()}`,
    createContextId,
  );
}

function getServerPageViewContextId(): string | null {
  return null;
}

export function HomepageAnalyticsProvider({
  homepageVersionId,
  children,
}: {
  homepageVersionId: string | null;
  children: ReactNode;
}) {
  const pageViewContextId = useSyncExternalStore(
    subscribe,
    getHomepagePageViewContextId,
    getServerPageViewContextId,
  );
  const value = useMemo<HomepageAnalyticsValue | null>(() => {
    if (!pageViewContextId) {
      return null;
    }
    return { homepageVersionId, pageViewContextId };
  }, [homepageVersionId, pageViewContextId]);

  return (
    <HomepageAnalyticsContext.Provider value={value}>
      {children}
    </HomepageAnalyticsContext.Provider>
  );
}

export function useHomepageAnalytics(): HomepageAnalyticsValue | null {
  return useContext(HomepageAnalyticsContext);
}
