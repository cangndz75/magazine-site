import {
  CONTENT_LEGAL_ACTION_TYPE,
  type ContentLegalActionType,
} from "./legal-action";

export const PUBLIC_LEGAL_NOTICE_KIND = {
  CORRECTION: "CORRECTION",
  CLARIFICATION: "CLARIFICATION",
} as const;

export type PublicLegalNoticeKind =
  (typeof PUBLIC_LEGAL_NOTICE_KIND)[keyof typeof PUBLIC_LEGAL_NOTICE_KIND];

export type PublicLegalNotice = {
  kind: PublicLegalNoticeKind;
  publicNote: string | null;
  effectiveAt: Date;
};

export const PUBLIC_ARTICLE_WITHDRAWAL_KIND = {
  RETRACTION: "RETRACTION",
  TAKEDOWN: "TAKEDOWN",
} as const;

export type PublicArticleWithdrawalKind =
  (typeof PUBLIC_ARTICLE_WITHDRAWAL_KIND)[keyof typeof PUBLIC_ARTICLE_WITHDRAWAL_KIND];

export type PublicWithdrawnArticleShell = {
  id: string;
  slug: string;
  title: string;
  publishedAt: Date;
  withdrawalKind: PublicArticleWithdrawalKind;
  publicNote: string | null;
  effectiveAt: Date;
};

export function toPublicLegalNotice(input: {
  actionType: ContentLegalActionType;
  publicNote: string | null;
  effectiveAt: Date | string;
}): PublicLegalNotice | null {
  const effectiveAt =
    input.effectiveAt instanceof Date
      ? input.effectiveAt
      : new Date(input.effectiveAt);

  if (input.actionType === CONTENT_LEGAL_ACTION_TYPE.CORRECTION) {
    return {
      kind: PUBLIC_LEGAL_NOTICE_KIND.CORRECTION,
      publicNote: input.publicNote,
      effectiveAt,
    };
  }

  if (input.actionType === CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION) {
    return {
      kind: PUBLIC_LEGAL_NOTICE_KIND.CLARIFICATION,
      publicNote: input.publicNote,
      effectiveAt,
    };
  }

  return null;
}

export function resolvePublicWithdrawalKind(input: {
  retractedAt: Date | string | null;
  takedownAt: Date | string | null;
}): PublicArticleWithdrawalKind {
  if (input.takedownAt != null) {
    return PUBLIC_ARTICLE_WITHDRAWAL_KIND.TAKEDOWN;
  }

  return PUBLIC_ARTICLE_WITHDRAWAL_KIND.RETRACTION;
}

/**
 * Legal actions that change the public article projection must invalidate
 * the existing public article cache authority.
 */
export function legalActionInvalidatesPublicCache(input: {
  actionType: ContentLegalActionType;
}): boolean {
  return (
    input.actionType === CONTENT_LEGAL_ACTION_TYPE.CORRECTION ||
    input.actionType === CONTENT_LEGAL_ACTION_TYPE.CLARIFICATION ||
    input.actionType === CONTENT_LEGAL_ACTION_TYPE.RETRACTION ||
    input.actionType === CONTENT_LEGAL_ACTION_TYPE.TAKEDOWN
  );
}
