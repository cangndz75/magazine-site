import {
  READINESS_OVERALL_STATE,
  READINESS_SECTION,
  READINESS_SECTION_STATE,
  type ArticleReadinessDTO,
  type ReadinessIssue,
} from "@magazine/domain";
import {
  getGalleryMedia,
  getHeroMedia,
  type ArticleEditorRelations,
} from "@/lib/content/article-relation-state";

function issue(
  code: string,
  severity: ReadinessIssue["severity"],
  label: string,
  targetSection: ReadinessIssue["targetSection"],
): ReadinessIssue {
  return { code, severity, label, targetSection };
}

function sectionState(
  issues: ReadinessIssue[],
): ArticleReadinessDTO["sections"][number]["state"] {
  if (issues.some((item) => item.severity === "blocker")) {
    return READINESS_SECTION_STATE.BLOCKED;
  }
  if (issues.some((item) => item.severity === "warning")) {
    return READINESS_SECTION_STATE.NEEDS_ATTENTION;
  }
  return READINESS_SECTION_STATE.READY;
}

function mergeIssues(
  existing: ReadinessIssue[],
  additions: ReadinessIssue[],
): ReadinessIssue[] {
  const codes = new Set(existing.map((item) => item.code));
  const merged = [...existing];
  for (const addition of additions) {
    if (!codes.has(addition.code)) {
      merged.push(addition);
      codes.add(addition.code);
    }
  }
  return merged;
}

function summarizeSections(
  sections: ArticleReadinessDTO["sections"],
): ArticleReadinessDTO["summary"] {
  let readyCount = 0;
  let attentionCount = 0;
  let blockedCount = 0;
  let notApplicableCount = 0;

  for (const section of sections) {
    switch (section.state) {
      case READINESS_SECTION_STATE.READY:
        readyCount += 1;
        break;
      case READINESS_SECTION_STATE.NEEDS_ATTENTION:
        attentionCount += 1;
        break;
      case READINESS_SECTION_STATE.BLOCKED:
        blockedCount += 1;
        break;
      case READINESS_SECTION_STATE.NOT_APPLICABLE:
        notApplicableCount += 1;
        break;
    }
  }

  const blockingIssues = sections.flatMap((item) =>
    item.issues.filter((issueItem: ReadinessIssue) => issueItem.severity === "blocker"),
  );

  return {
    readyCount,
    attentionCount,
    blockedCount,
    notApplicableCount,
    blockingIssueCount: blockingIssues.length,
  };
}

function deriveOverallState(
  summary: ArticleReadinessDTO["summary"],
): ArticleReadinessDTO["overallState"] {
  if (summary.blockingIssueCount > 0) {
    return READINESS_OVERALL_STATE.BLOCKED;
  }
  if (summary.attentionCount > 0) {
    return READINESS_OVERALL_STATE.NEEDS_ATTENTION;
  }
  return READINESS_OVERALL_STATE.READY;
}

export function presentPhotoGalleryReadiness(
  readiness: ArticleReadinessDTO,
  relations: ArticleEditorRelations,
): ArticleReadinessDTO {
  const hero = getHeroMedia(relations);
  const gallery = getGalleryMedia(relations);
  const galleryMedia = [hero, ...gallery].filter(
    (item): item is NonNullable<typeof hero> => item !== null,
  );
  const blockedCount = galleryMedia.filter(
    (item) => item.eligibility?.eligible === false,
  ).length;
  const creditMissingCount = galleryMedia.filter((item) => {
    const relationCredit = item.credit?.trim();
    const assetCredit = item.creditLine?.trim();
    return !relationCredit && !assetCredit;
  }).length;

  const galleryMediaIssues: ReadinessIssue[] = [];
  if (!hero) {
    galleryMediaIssues.push(
      issue(
        "GALLERY_COVER_MISSING",
        "blocker",
        "Kapak görseli eksik.",
        READINESS_SECTION.MEDIA,
      ),
    );
  }
  if (gallery.length === 0) {
    galleryMediaIssues.push(
      issue(
        "GALLERY_IMAGES_MISSING",
        "blocker",
        "Galeri görseli eklenmemiş.",
        READINESS_SECTION.MEDIA,
      ),
    );
  }
  if (blockedCount > 0) {
    galleryMediaIssues.push(
      issue(
        "GALLERY_MEDIA_INELIGIBLE",
        "blocker",
        "Kullanıma uygun olmayan medya var.",
        READINESS_SECTION.RIGHTS,
      ),
    );
  }
  if (creditMissingCount > 0) {
    galleryMediaIssues.push(
      issue(
        "GALLERY_CREDIT_MISSING",
        "warning",
        "Zorunlu kredi eksik.",
        READINESS_SECTION.MEDIA,
      ),
    );
  }

  const sections = readiness.sections.map((section) => {
    if (section.id === READINESS_SECTION.CONTENT) {
      const issues = section.issues.filter((item) => item.code !== "BODY_EMPTY");
      return {
        ...section,
        issues,
        state: sectionState(issues),
      };
    }

    if (section.id === READINESS_SECTION.MEDIA) {
      const issues = mergeIssues(section.issues, galleryMediaIssues.filter(
        (item) => item.targetSection === READINESS_SECTION.MEDIA,
      ));
      return {
        ...section,
        issues,
        state: sectionState(issues),
      };
    }

    if (section.id === READINESS_SECTION.RIGHTS) {
      const issues = mergeIssues(
        section.issues,
        galleryMediaIssues.filter(
          (item) => item.targetSection === READINESS_SECTION.RIGHTS,
        ),
      );
      return {
        ...section,
        issues,
        state: sectionState(issues),
      };
    }

    if (section.id === READINESS_SECTION.ENTITIES) {
      return {
        ...section,
        state: READINESS_SECTION_STATE.NOT_APPLICABLE,
        issues: [],
      };
    }

    return section;
  });

  const blockingIssues = sections.flatMap((item) =>
    item.issues.filter((issueItem: ReadinessIssue) => issueItem.severity === "blocker"),
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
