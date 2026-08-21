import type { PublicationStatus } from "../publication-status";
import type { WorkflowStatus } from "../workflow-status";
import { WORKFLOW_STATUS } from "../workflow-status";
import {
  READINESS_OVERALL_STATE,
  type ReadinessOverallState,
} from "./readiness";

export const NEWSROOM_VIEW = {
  ALL: "all",
  ATTENTION: "attention",
  IN_REVIEW: "in_review",
  SCHEDULED: "scheduled",
  PUBLISHED: "published",
  DRAFTS: "drafts",
} as const;

export type NewsroomView = (typeof NEWSROOM_VIEW)[keyof typeof NEWSROOM_VIEW];

export const NEWSROOM_VIEWS = Object.values(NEWSROOM_VIEW);

export const NEWSROOM_SORT = {
  UPDATED_DESC: "updated_desc",
  PUBLISHED_DESC: "published_desc",
  PUBLISHED_ASC: "published_asc",
  SCHEDULE_ASC: "schedule_asc",
} as const;

export type NewsroomSort = (typeof NEWSROOM_SORT)[keyof typeof NEWSROOM_SORT];

export const NEWSROOM_SORTS = Object.values(NEWSROOM_SORT);

export type NewsroomViewCounts = {
  all: number;
  attention: number;
  inReview: number;
  scheduled: number;
  published: number;
  drafts: number;
};

export type ListAttentionSeverity = "none" | "warning" | "blocked";

export type ListAttentionSummary = {
  severity: ListAttentionSeverity;
  label: string | null;
  issueCount: number;
  topCode: string | null;
};

export type ArticleReadinessSummaryDTO = {
  overallState: ReadinessOverallState;
  blockingCount: number;
  warningCount: number;
  topIssue: string | null;
};

export type NewsroomListReadinessInput = {
  publicationStatus: PublicationStatus;
  workflowStatus: WorkflowStatus;
  hasPrimaryCategory: boolean;
  authorCount: number;
  legalHoldAt: string | null;
  retractedAt: string | null;
  takedownAt: string | null;
  changesRequestedNote: string | null;
  heroAssigned: boolean;
  heroRightsEligible: boolean | null;
};

const VIEW_SET = new Set<string>(NEWSROOM_VIEWS);
const SORT_SET = new Set<string>(NEWSROOM_SORTS);

export function parseNewsroomView(value: string | undefined): NewsroomView {
  if (value && VIEW_SET.has(value)) {
    return value as NewsroomView;
  }
  return NEWSROOM_VIEW.ALL;
}

export function parseNewsroomSort(value: string | undefined): NewsroomSort {
  if (value && SORT_SET.has(value)) {
    return value as NewsroomSort;
  }
  return NEWSROOM_SORT.UPDATED_DESC;
}

export function summarizeListAttention(
  input: NewsroomListReadinessInput,
): ListAttentionSummary {
  const issues: { code: string; severity: ListAttentionSeverity; label: string }[] =
    [];

  if (input.legalHoldAt) {
    issues.push({
      code: "LEGAL_HOLD",
      severity: "blocked",
      label: "Yasal hold",
    });
  }
  if (input.retractedAt) {
    issues.push({
      code: "RETRACTION",
      severity: "blocked",
      label: "Geri çekildi",
    });
  }
  if (input.takedownAt) {
    issues.push({
      code: "TAKEDOWN",
      severity: "blocked",
      label: "Hukuki kaldırma",
    });
  }
  if (input.changesRequestedNote) {
    issues.push({
      code: "CHANGES_REQUESTED",
      severity: "warning",
      label: "Değişiklik istendi",
    });
  }
  if (
    input.workflowStatus === WORKFLOW_STATUS.APPROVED &&
    !input.hasPrimaryCategory
  ) {
    issues.push({
      code: "PUBLISH_BLOCKED",
      severity: "blocked",
      label: "Yayın engeli",
    });
  }
  if (!input.hasPrimaryCategory && input.workflowStatus === WORKFLOW_STATUS.DRAFT) {
    issues.push({
      code: "PRIMARY_CATEGORY_MISSING",
      severity: "warning",
      label: "Ana kategori eksik",
    });
  }
  if (input.authorCount === 0) {
    issues.push({
      code: "AUTHOR_MISSING",
      severity: "warning",
      label: "Yazar atanmadı",
    });
  }
  if (input.heroRightsEligible === false) {
    issues.push({
      code: "HERO_RIGHTS",
      severity: "warning",
      label: "Medya hakkı kontrolü",
    });
  }

  if (issues.length === 0) {
    return {
      severity: "none",
      label: null,
      issueCount: 0,
      topCode: null,
    };
  }

  const blocked = issues.filter((item) => item.severity === "blocked");
  const top = blocked[0] ?? issues[0]!;
  const severity: ListAttentionSeverity =
    blocked.length > 0 ? "blocked" : "warning";

  let label = top.label;
  if (issues.length > 1) {
    label = `${issues.length} konu kontrol edilmeli`;
  }

  return {
    severity,
    label,
    issueCount: issues.length,
    topCode: top.code,
  };
}

export function summarizeNewsroomReadiness(
  input: NewsroomListReadinessInput,
): ArticleReadinessSummaryDTO {
  const attention = summarizeListAttention(input);
  const blockingCount = attention.severity === "blocked" ? attention.issueCount : 0;
  const warningCount = attention.severity === "warning" ? attention.issueCount : 0;

  let overallState: ReadinessOverallState = READINESS_OVERALL_STATE.READY;
  if (blockingCount > 0) {
    overallState = READINESS_OVERALL_STATE.BLOCKED;
  } else if (warningCount > 0) {
    overallState = READINESS_OVERALL_STATE.NEEDS_ATTENTION;
  }

  return {
    overallState,
    blockingCount,
    warningCount,
    topIssue: attention.label,
  };
}

export function newsroomViewMatchesAttention(
  input: NewsroomListReadinessInput,
): boolean {
  return summarizeListAttention(input).severity !== "none";
}
