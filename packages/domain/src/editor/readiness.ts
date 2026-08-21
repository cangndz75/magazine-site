import { ENTITY_STATUS } from "../entity/types";
import {
  hasPublicLegalWithdrawal,
  isContentLegalHoldActive,
} from "../legal-action";
import type { PublicationStatus } from "../publication-status";
import { assertPublishReady } from "../publishing/invariants";
import { inspectStructuredArticleBody } from "../seo/body-inspection";
import { evaluateDiscoverReadiness } from "../seo/discover";
import { evaluateSeoHealth, type SeoHeroEvaluationInput } from "../seo/health";
import { SEO_FINDING_SEVERITY } from "../seo/policy";
import type { WorkflowStatus } from "../workflow-status";
import { canonicalizeDraftTitle } from "./fields";

export const READINESS_SECTION = {
  PUBLICATION: "publication",
  SEO: "seo",
  CONTENT: "content",
  MEDIA: "media",
  RIGHTS: "rights",
  ENTITIES: "entities",
  LEGAL: "legal",
} as const;

export type ReadinessSectionId =
  (typeof READINESS_SECTION)[keyof typeof READINESS_SECTION];

export const READINESS_SECTION_STATE = {
  READY: "READY",
  NEEDS_ATTENTION: "NEEDS_ATTENTION",
  BLOCKED: "BLOCKED",
  NOT_APPLICABLE: "NOT_APPLICABLE",
} as const;

export type ReadinessSectionState =
  (typeof READINESS_SECTION_STATE)[keyof typeof READINESS_SECTION_STATE];

export const READINESS_OVERALL_STATE = {
  READY: "READY",
  NEEDS_ATTENTION: "NEEDS_ATTENTION",
  BLOCKED: "BLOCKED",
} as const;

export type ReadinessOverallState =
  (typeof READINESS_OVERALL_STATE)[keyof typeof READINESS_OVERALL_STATE];

export type ReadinessIssueSeverity = "blocker" | "warning" | "info";

export type ReadinessIssue = {
  code: string;
  severity: ReadinessIssueSeverity;
  label: string;
  targetSection: ReadinessSectionId;
};

export type ReadinessSection = {
  id: ReadinessSectionId;
  state: ReadinessSectionState;
  issues: ReadinessIssue[];
};

export type ArticleReadinessSummary = {
  readyCount: number;
  attentionCount: number;
  blockedCount: number;
  notApplicableCount: number;
  blockingIssueCount: number;
};

export type ArticleReadinessDTO = {
  overallState: ReadinessOverallState;
  sections: ReadinessSection[];
  blockingIssues: ReadinessIssue[];
  warnings: ReadinessIssue[];
  summary: ArticleReadinessSummary;
};

export type ArticleReadinessEntity = {
  id: string;
  status: string;
};

export type ArticleReadinessHero = {
  assigned: boolean;
  publicUrl: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  preferredRenditionAvailable: boolean;
  usedLegacyOriginalFallback: boolean;
  rightsEligible: boolean | null;
  rightsStatus: string | null;
  rightsReasons: readonly string[];
};

export type ArticleReadinessInput = {
  trustedSiteUrl: string;
  editorOrigin?: string | null;
  slug: string;
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  publishedAt: string | null;
  publicDateModified?: string | null;
  workflowStatus: WorkflowStatus | null;
  legalHoldAt: string | null;
  retractedAt: string | null;
  takedownAt: string | null;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  excerpt: string | null;
  subtitle: string | null;
  storedCanonicalUrl: string | null;
  storedRobots: string | null;
  body: unknown;
  bodyInspectable: boolean;
  categories: readonly { isPrimary: boolean; name?: string }[];
  authors: readonly { displayName: string }[];
  entities: readonly ArticleReadinessEntity[];
  hero: ArticleReadinessHero | null;
  fieldValidationOk: boolean;
  fieldValidationErrors: readonly string[];
  pendingLinkSuggestionCount?: number;
  ambiguousLinkSuggestionCount?: number;
};

function issue(
  code: string,
  severity: ReadinessIssueSeverity,
  label: string,
  targetSection: ReadinessSectionId,
): ReadinessIssue {
  return { code, severity, label, targetSection };
}

function section(
  id: ReadinessSectionId,
  issues: ReadinessIssue[],
): ReadinessSection {
  const hasBlocker = issues.some((item) => item.severity === "blocker");
  const hasWarning = issues.some((item) => item.severity === "warning");

  let state: ReadinessSectionState = READINESS_SECTION_STATE.READY;
  if (hasBlocker) {
    state = READINESS_SECTION_STATE.BLOCKED;
  } else if (hasWarning) {
    state = READINESS_SECTION_STATE.NEEDS_ATTENTION;
  }

  return { id, state, issues };
}

function notApplicableSection(id: ReadinessSectionId): ReadinessSection {
  return {
    id,
    state: READINESS_SECTION_STATE.NOT_APPLICABLE,
    issues: [],
  };
}

function toSeoHeroInput(hero: ArticleReadinessHero | null): SeoHeroEvaluationInput | null {
  if (!hero?.assigned) {
    return null;
  }

  return {
    assigned: true,
    publicUrl: hero.publicUrl,
    altText: hero.altText,
    width: hero.width,
    height: hero.height,
    preferredRenditionAvailable: hero.preferredRenditionAvailable,
    usedLegacyOriginalFallback: hero.usedLegacyOriginalFallback,
    rightsEligible: hero.rightsEligible,
    rightsStatus: hero.rightsStatus as SeoHeroEvaluationInput["rightsStatus"],
    rightsReasons: hero.rightsReasons as SeoHeroEvaluationInput["rightsReasons"],
  };
}

function evaluatePublicationSection(input: ArticleReadinessInput): ReadinessSection {
  const issues: ReadinessIssue[] = [];

  if (isContentLegalHoldActive(input.legalHoldAt)) {
    issues.push(
      issue(
        "LEGAL_HOLD",
        "blocker",
        "Legal hold aktif; yayın işlemleri engellendi.",
        READINESS_SECTION.PUBLICATION,
      ),
    );
  }

  if (hasPublicLegalWithdrawal(input)) {
    issues.push(
      issue(
        "LEGAL_WITHDRAWAL",
        "blocker",
        "Hukuki geri çekme veya kaldırma nedeniyle yayın engellendi.",
        READINESS_SECTION.PUBLICATION,
      ),
    );
  }

  if (input.workflowStatus === "IN_REVIEW") {
    issues.push(
      issue(
        "IN_REVIEW",
        "warning",
        "Sürüm inceleme bekliyor.",
        READINESS_SECTION.PUBLICATION,
      ),
    );
  }

  if (input.workflowStatus === "DRAFT") {
    issues.push(
      issue(
        "DRAFT",
        "warning",
        "Sürüm henüz onaylanmadı.",
        READINESS_SECTION.PUBLICATION,
      ),
    );
  }

  if (input.workflowStatus) {
    const publishReady = assertPublishReady({
      workflowStatus: input.workflowStatus,
      categories: input.categories,
    });
    if (!publishReady.ok && input.workflowStatus === "APPROVED") {
      issues.push(
        issue(
          publishReady.code,
          "blocker",
          "Yayın için onaylı sürüm ve ana kategori gerekir.",
          READINESS_SECTION.PUBLICATION,
        ),
      );
    }
  }

  return section(READINESS_SECTION.PUBLICATION, issues);
}

function evaluateContentSection(input: ArticleReadinessInput): ReadinessSection {
  const issues: ReadinessIssue[] = [];
  const title = canonicalizeDraftTitle(input.title);

  if (!title.ok) {
    issues.push(
      issue(
        "TITLE_MISSING",
        "blocker",
        "Başlık zorunlu.",
        READINESS_SECTION.CONTENT,
      ),
    );
  }

  if (!input.bodyInspectable) {
    issues.push(
      issue(
        "BODY_UNINSPECTABLE",
        "blocker",
        "Gövde güvenli şekilde doğrulanamıyor.",
        READINESS_SECTION.CONTENT,
      ),
    );
  } else {
    const body = inspectStructuredArticleBody(input.body);
    if (!body.present || body.textLength === 0) {
      issues.push(
        issue(
          "BODY_EMPTY",
          "blocker",
          "Gövde metni gerekli.",
          READINESS_SECTION.CONTENT,
        ),
      );
    }
  }

  if (!input.categories.some((item) => item.isPrimary)) {
    issues.push(
      issue(
        "PRIMARY_CATEGORY_MISSING",
        "blocker",
        "Ana kategori seçilmedi.",
        READINESS_SECTION.CONTENT,
      ),
    );
  }

  if (input.authors.length === 0) {
    issues.push(
      issue(
        "AUTHOR_MISSING",
        "warning",
        "Yazar atanmadı.",
        READINESS_SECTION.CONTENT,
      ),
    );
  }

  for (const message of input.fieldValidationErrors) {
    issues.push(
      issue(
        "FIELD_VALIDATION",
        "warning",
        message,
        READINESS_SECTION.CONTENT,
      ),
    );
  }

  if (!input.fieldValidationOk) {
    issues.push(
      issue(
        "FIELD_VALIDATION_FAILED",
        "warning",
        "Bazı alanlar doğrulamadan geçmedi.",
        READINESS_SECTION.CONTENT,
      ),
    );
  }

  return section(READINESS_SECTION.CONTENT, dedupeIssues(issues));
}

function evaluateMediaSection(input: ArticleReadinessInput): ReadinessSection {
  const hero = input.hero;
  if (!hero?.assigned) {
    return section(READINESS_SECTION.MEDIA, [
      issue(
        "HERO_MISSING",
        "warning",
        "Kapak görseli seçilmedi.",
        READINESS_SECTION.MEDIA,
      ),
    ]);
  }

  const issues: ReadinessIssue[] = [];
  if (!hero.altText?.trim()) {
    issues.push(
      issue(
        "HERO_ALT_MISSING",
        "warning",
        "Kapak görseli alt metni eksik.",
        READINESS_SECTION.MEDIA,
      ),
    );
  }

  if (!hero.publicUrl) {
    issues.push(
      issue(
        "HERO_PUBLIC_URL_MISSING",
        "warning",
        "Kapak görseli kamu önizlemesi hazır değil.",
        READINESS_SECTION.MEDIA,
      ),
    );
  }

  return section(READINESS_SECTION.MEDIA, issues);
}

function evaluateRightsSection(input: ArticleReadinessInput): ReadinessSection {
  const hero = input.hero;
  if (!hero?.assigned) {
    return notApplicableSection(READINESS_SECTION.RIGHTS);
  }

  if (hero.rightsEligible === false) {
    return section(READINESS_SECTION.RIGHTS, [
      issue(
        "HERO_RIGHTS_INELIGIBLE",
        "warning",
        "Kapak görseli kamu kullanımına uygun değil.",
        READINESS_SECTION.RIGHTS,
      ),
    ]);
  }

  if (hero.rightsEligible === null) {
    return section(READINESS_SECTION.RIGHTS, [
      issue(
        "HERO_RIGHTS_UNKNOWN",
        "warning",
        "Kapak görseli hak durumu doğrulanamadı.",
        READINESS_SECTION.RIGHTS,
      ),
    ]);
  }

  return section(READINESS_SECTION.RIGHTS, []);
}

function evaluateEntitiesSection(input: ArticleReadinessInput): ReadinessSection {
  if (input.entities.length === 0) {
    return section(READINESS_SECTION.ENTITIES, []);
  }

  const issues: ReadinessIssue[] = [];
  const archivedCount = input.entities.filter(
    (item) => item.status === ENTITY_STATUS.ARCHIVED,
  ).length;

  if (archivedCount > 0) {
    issues.push(
      issue(
        "ENTITY_ARCHIVED",
        "warning",
        `${archivedCount} arşivlenmiş varlık ilişkisi var.`,
        READINESS_SECTION.ENTITIES,
      ),
    );
  }

  if ((input.pendingLinkSuggestionCount ?? 0) > 0) {
    issues.push(
      issue(
        "LINK_SUGGESTIONS_PENDING",
        "warning",
        `${input.pendingLinkSuggestionCount} iç bağlantı önerisi incelenmedi.`,
        READINESS_SECTION.ENTITIES,
      ),
    );
  }

  if ((input.ambiguousLinkSuggestionCount ?? 0) > 0) {
    issues.push(
      issue(
        "LINK_SUGGESTIONS_AMBIGUOUS",
        "warning",
        `${input.ambiguousLinkSuggestionCount} belirsiz eşleşme seçim bekliyor.`,
        READINESS_SECTION.ENTITIES,
      ),
    );
  }

  return section(READINESS_SECTION.ENTITIES, issues);
}

function evaluateLegalSection(input: ArticleReadinessInput): ReadinessSection {
  const issues: ReadinessIssue[] = [];

  if (isContentLegalHoldActive(input.legalHoldAt)) {
    issues.push(
      issue(
        "LEGAL_HOLD",
        "blocker",
        "Legal hold aktif.",
        READINESS_SECTION.LEGAL,
      ),
    );
  }

  if (input.retractedAt) {
    issues.push(
      issue(
        "RETRACTION",
        "blocker",
        "Haber geri çekildi.",
        READINESS_SECTION.LEGAL,
      ),
    );
  }

  if (input.takedownAt) {
    issues.push(
      issue(
        "TAKEDOWN",
        "blocker",
        "Hukuki kaldırma uygulandı.",
        READINESS_SECTION.LEGAL,
      ),
    );
  }

  if (issues.length === 0) {
    return section(READINESS_SECTION.LEGAL, []);
  }

  return section(READINESS_SECTION.LEGAL, issues);
}

function evaluateSeoSection(input: ArticleReadinessInput): ReadinessSection {
  const primaryCategoryName =
    input.categories.find((item) => item.isPrimary)?.name ?? null;
  const seoHero = toSeoHeroInput(input.hero);

  const health = evaluateSeoHealth({
    trustedSiteUrl: input.trustedSiteUrl,
    editorOrigin: input.editorOrigin,
    slug: input.slug,
    title: input.title,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    excerpt: input.excerpt,
    subtitle: input.subtitle,
    storedCanonicalUrl: input.storedCanonicalUrl,
    storedRobots: input.storedRobots,
    publicationStatus: input.publicationStatus,
    publishedVersionId: input.publishedVersionId,
    publishedAt: input.publishedAt,
    publicDateModified: input.publicDateModified ?? null,
    retractedAt: input.retractedAt,
    takedownAt: input.takedownAt,
    primaryCategoryName,
    authors: input.authors.map((item) => item.displayName),
    hero: seoHero,
    body: input.body,
  });

  const discover = evaluateDiscoverReadiness({
    trustedSiteUrl: input.trustedSiteUrl,
    indexability: health.indexability,
    publicTitle: health.publicTitle,
    publicDescription: health.publicDescription,
    canonical: { url: health.publicCanonicalUrl },
    publishedAt: input.publishedAt,
    authors: input.authors.map((item) => item.displayName),
    hero: seoHero
      ? {
          assigned: true,
          publicUrl: seoHero.publicUrl,
          altText: seoHero.altText,
          width: seoHero.width,
          height: seoHero.height,
        }
      : { assigned: false, publicUrl: null, altText: null, width: null, height: null },
    structuredData: health.structuredData,
    publisher: null,
  });

  const issues: ReadinessIssue[] = [];

  for (const finding of health.findings) {
    if (finding.severity === SEO_FINDING_SEVERITY.INFO) {
      continue;
    }

    issues.push(
      issue(
        finding.code,
        finding.severity === SEO_FINDING_SEVERITY.ERROR ? "warning" : "warning",
        finding.message,
        READINESS_SECTION.SEO,
      ),
    );
  }

  if (discover.state !== "READY") {
    const topFinding = discover.findings[0];
    issues.push(
      issue(
        topFinding?.code ?? "DISCOVER_NOT_READY",
        "warning",
        topFinding?.message ?? "Discover hazırlığı tamamlanmadı.",
        READINESS_SECTION.SEO,
      ),
    );
  }

  return section(READINESS_SECTION.SEO, dedupeIssues(issues));
}

function dedupeIssues(issues: ReadinessIssue[]): ReadinessIssue[] {
  const seen = new Set<string>();
  return issues.filter((item) => {
    const key = `${item.code}:${item.label}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function summarizeSections(sections: ReadinessSection[]): ArticleReadinessSummary {
  let readyCount = 0;
  let attentionCount = 0;
  let blockedCount = 0;
  let notApplicableCount = 0;

  for (const item of sections) {
    if (item.state === READINESS_SECTION_STATE.READY) {
      readyCount += 1;
    } else if (item.state === READINESS_SECTION_STATE.NEEDS_ATTENTION) {
      attentionCount += 1;
    } else if (item.state === READINESS_SECTION_STATE.BLOCKED) {
      blockedCount += 1;
    } else {
      notApplicableCount += 1;
    }
  }

  const blockingIssues = sections.flatMap((item) =>
    item.issues.filter((issueItem) => issueItem.severity === "blocker"),
  );

  return {
    readyCount,
    attentionCount,
    blockedCount,
    notApplicableCount,
    blockingIssueCount: blockingIssues.length,
  };
}

function deriveOverallState(summary: ArticleReadinessSummary): ReadinessOverallState {
  if (summary.blockingIssueCount > 0) {
    return READINESS_OVERALL_STATE.BLOCKED;
  }
  if (summary.attentionCount > 0) {
    return READINESS_OVERALL_STATE.NEEDS_ATTENTION;
  }
  return READINESS_OVERALL_STATE.READY;
}

export function evaluateArticleReadiness(
  input: ArticleReadinessInput,
): ArticleReadinessDTO {
  const sections = [
    evaluatePublicationSection(input),
    evaluateSeoSection(input),
    evaluateContentSection(input),
    evaluateMediaSection(input),
    evaluateRightsSection(input),
    evaluateEntitiesSection(input),
    evaluateLegalSection(input),
  ];

  const blockingIssues = sections.flatMap((item) =>
    item.issues.filter((issueItem) => issueItem.severity === "blocker"),
  );
  const warnings = sections.flatMap((item) =>
    item.issues.filter((issueItem) => issueItem.severity === "warning"),
  );
  const summary = summarizeSections(sections);

  return {
    overallState: deriveOverallState(summary),
    sections,
    blockingIssues,
    warnings,
    summary,
  };
}
