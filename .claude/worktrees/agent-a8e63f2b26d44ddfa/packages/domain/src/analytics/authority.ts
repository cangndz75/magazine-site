import { publicPublishedVersionId } from "../content-item-invariants";
import {
  PUBLIC_ARTICLE_WITHDRAWAL_KIND,
  resolvePublicWithdrawalKind,
  type PublicArticleWithdrawalKind,
} from "../public-legal";
import type { PublicationStatus } from "../publication-status";
import { ANALYTICS_EVENT_NAME } from "./taxonomy";

export type PublicContentAnalyticsState = {
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  deletedAt?: Date | string | null;
  retractedAt?: Date | string | null;
  takedownAt?: Date | string | null;
};

export type PublicContentAnalyticsClassification =
  | {
      kind: typeof ANALYTICS_EVENT_NAME.ARTICLE_VIEW;
      publishedVersionId: string;
    }
  | {
      kind: typeof ANALYTICS_EVENT_NAME.PAGE_VIEW;
      surface: "WITHDRAWN_SHELL";
      withdrawalKind: PublicArticleWithdrawalKind;
    }
  | {
      kind: "NOT_PUBLIC";
    };

/**
 * Live published articles produce ARTICLE_VIEW only.
 * Retraction/takedown shells are PAGE_VIEW, never ARTICLE_VIEW.
 * Correction/clarification remain ordinary ARTICLE_VIEW because the body stays public.
 * Ordinary unpublish is not a public view.
 */
export function classifyPublicContentAnalytics(
  state: PublicContentAnalyticsState,
): PublicContentAnalyticsClassification {
  if (state.deletedAt != null) {
    return { kind: "NOT_PUBLIC" };
  }

  if (state.retractedAt != null || state.takedownAt != null) {
    return {
      kind: ANALYTICS_EVENT_NAME.PAGE_VIEW,
      surface: "WITHDRAWN_SHELL",
      withdrawalKind: resolvePublicWithdrawalKind({
        retractedAt: state.retractedAt ?? null,
        takedownAt: state.takedownAt ?? null,
      }),
    };
  }

  const publishedVersionId = publicPublishedVersionId(state);
  if (!publishedVersionId) {
    return { kind: "NOT_PUBLIC" };
  }

  return {
    kind: ANALYTICS_EVENT_NAME.ARTICLE_VIEW,
    publishedVersionId,
  };
}

export function articleViewIsAuthoritative(state: PublicContentAnalyticsState): boolean {
  return classifyPublicContentAnalytics(state).kind === ANALYTICS_EVENT_NAME.ARTICLE_VIEW;
}

export function withdrawnShellIsArticleView(): false {
  return false;
}

export const PUBLIC_WITHDRAWAL_ANALYTICS_KINDS = [
  PUBLIC_ARTICLE_WITHDRAWAL_KIND.RETRACTION,
  PUBLIC_ARTICLE_WITHDRAWAL_KIND.TAKEDOWN,
] as const;
