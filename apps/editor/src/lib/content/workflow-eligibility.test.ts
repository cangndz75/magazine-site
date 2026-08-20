import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REVIEW_NOTE_MAX_LENGTH, REVIEW_NOTE_MIN_LENGTH } from "@magazine/domain";
import {
  canApproveReview,
  canCreateDraftRevision,
  canPublishVersion,
  canRequestChangesAction,
  canScheduleVersion,
  canSubmitForReview,
  canUnpublish,
  presentWorkflow,
  revisionRequestSource,
  UNPUBLISH_ACTION_LABEL,
  UNPUBLISH_EFFECT_COPY,
  type WorkflowEligibilityInput,
} from "./workflow-eligibility";
import {
  isSuccessfulWorkflowResponse,
  presentWorkflowFailure,
  presentWorkflowSuccess,
} from "./workflow-messages";

const ITEM = "11111111-1111-4111-8111-111111111111";
const DRAFT = "22222222-2222-4222-8222-222222222222";
const PUBLISHED = "33333333-3333-4333-8333-333333333333";

function input(
  overrides: Partial<WorkflowEligibilityInput> = {},
): WorkflowEligibilityInput {
  return {
    contentItemId: ITEM,
    publicationStatus: "NEVER_PUBLISHED",
    workflowStatus: "DRAFT",
    focusedVersionId: DRAFT,
    focusedVersionNumber: 1,
    draftVersionId: DRAFT,
    publishedVersionId: null,
    scheduledVersionId: null,
    scheduledAt: null,
    publishedVersionNumber: null,
    draftVersionNumber: 1,
    scheduledVersionNumber: null,
    categories: [{ isPrimary: true }],
    permissions: {
      canEdit: true,
      canReview: false,
      canPublish: false,
    },
    isDirty: false,
    hasConcurrencyToken: true,
    legalHoldAt: null,
    retractedAt: null,
    takedownAt: null,
    ...overrides,
  };
}

describe("workflow eligibility presentation", () => {
  it("lets an eligible current draft submit for review", () => {
    const presented = presentWorkflow(input());
    assert.equal(canSubmitForReview(input()), true);
    assert.equal(presented.primary?.id, "submit-review");
    assert.equal(presented.primary?.label, "İncelemeye gönder");
    assert.equal(presented.publicationLabel, "Hiç yayınlanmadı");
    assert.equal(presented.workflowLabel, "Taslak");
  });

  it("blocks submit when the draft is dirty, unauthorized, or not the current draft", () => {
    assert.equal(canSubmitForReview(input({ isDirty: true })), false);
    assert.equal(
      canSubmitForReview(
        input({ permissions: { canEdit: false, canReview: false, canPublish: false } }),
      ),
      false,
    );
    assert.equal(
      canSubmitForReview(input({ workflowStatus: "IN_REVIEW" })),
      false,
    );
    assert.equal(
      canSubmitForReview(input({ focusedVersionId: PUBLISHED, draftVersionId: DRAFT })),
      false,
    );
    assert.equal(
      presentWorkflow(input({ isDirty: true })).unavailableReason?.includes("Kaydedilmemiş"),
      true,
    );
  });

  it("lets a reviewer approve or request changes on the reviewed IN_REVIEW version", () => {
    const reviewing = input({
      workflowStatus: "IN_REVIEW",
      permissions: { canEdit: true, canReview: true, canPublish: false },
    });
    assert.equal(canApproveReview(reviewing), true);
    assert.equal(canRequestChangesAction(reviewing), true);
    assert.equal(canSubmitForReview(reviewing), false);
    const presented = presentWorkflow(reviewing);
    assert.equal(presented.primary?.id, "approve");
    assert.equal(presented.primary?.label, "Onayla");
    assert.equal(presented.secondary[0]?.id, "request-changes");
    assert.equal(presented.secondary[0]?.label, "Değişiklik iste");
    assert.equal(presented.showReturnToQueue, true);
    assert.equal(presented.needsReviewNote, true);
  });

  it("does not treat edit permission as review or publish permission", () => {
    const inReview = input({ workflowStatus: "IN_REVIEW" });
    assert.equal(canApproveReview(inReview), false);
    assert.equal(canRequestChangesAction(inReview), false);

    const approved = input({
      workflowStatus: "APPROVED",
      permissions: { canEdit: true, canReview: false, canPublish: false },
    });
    assert.equal(canPublishVersion(approved), false);
    assert.equal(canScheduleVersion(approved), false);
    assert.equal(
      presentWorkflow(approved).unavailableReason?.includes("Yayınlama yetkin yok"),
      true,
    );
  });

  it("rejects approve and request-changes when the focused version is not IN_REVIEW", () => {
    const reviewer = {
      canEdit: false,
      canReview: true,
      canPublish: false,
    };
    assert.equal(
      canApproveReview(input({ workflowStatus: "DRAFT", permissions: reviewer })),
      false,
    );
    assert.equal(
      canApproveReview(input({ workflowStatus: "APPROVED", permissions: reviewer })),
      false,
    );
    assert.equal(
      canRequestChangesAction(input({ workflowStatus: "DRAFT", permissions: reviewer })),
      false,
    );
  });

  it("lets an authorized publisher publish or schedule an approved eligible version", () => {
    const approved = input({
      workflowStatus: "APPROVED",
      permissions: { canEdit: true, canReview: true, canPublish: true },
    });
    assert.equal(canPublishVersion(approved), true);
    assert.equal(canScheduleVersion(approved), true);
    const presented = presentWorkflow(approved);
    assert.equal(presented.primary?.id, "publish");
    assert.equal(presented.primary?.label, "Yayınla");
    assert.equal(presented.secondary[0]?.id, "schedule");
    assert.equal(presented.confirmPublish, true);
    assert.equal(presented.needsScheduleInput, true);
  });

  it("does not offer publish for an unapproved version", () => {
    const publisher = {
      canEdit: true,
      canReview: true,
      canPublish: true,
    };
    assert.equal(
      canPublishVersion(input({ workflowStatus: "DRAFT", permissions: publisher })),
      false,
    );
    assert.equal(
      canPublishVersion(input({ workflowStatus: "IN_REVIEW", permissions: publisher })),
      false,
    );
  });

  it("keeps publication and workflow axes separate for a published item with a new draft", () => {
    const presented = presentWorkflow(
      input({
        publicationStatus: "PUBLISHED",
        workflowStatus: "DRAFT",
        publishedVersionId: PUBLISHED,
        publishedVersionNumber: 1,
        focusedVersionId: DRAFT,
        focusedVersionNumber: 2,
        draftVersionId: DRAFT,
        draftVersionNumber: 2,
      }),
    );
    assert.equal(presented.publicationLabel, "Yayında");
    assert.equal(presented.workflowLabel, "Taslak");
    assert.equal(presented.publishedVersionLabel, "Sürüm 1");
    assert.equal(presented.draftVersionLabel, "Sürüm 2");
    assert.equal(presented.primary?.id, "submit-review");
    assert.equal(canPublishVersion(input({
      publicationStatus: "PUBLISHED",
      workflowStatus: "DRAFT",
      publishedVersionId: PUBLISHED,
      focusedVersionId: DRAFT,
      draftVersionId: DRAFT,
      permissions: { canEdit: true, canReview: true, canPublish: true },
    })), false);
  });

  it("does not offer scheduling for the currently published version", () => {
    assert.equal(
      canScheduleVersion(
        input({
          publicationStatus: "PUBLISHED",
          workflowStatus: "APPROVED",
          focusedVersionId: PUBLISHED,
          publishedVersionId: PUBLISHED,
          draftVersionId: null,
          permissions: { canEdit: false, canReview: false, canPublish: true },
        }),
      ),
      false,
    );
  });

  it("offers a new draft on a published article with no active draft", () => {
    const published = input({
      publicationStatus: "PUBLISHED",
      workflowStatus: "APPROVED",
      focusedVersionId: PUBLISHED,
      focusedVersionNumber: 1,
      publishedVersionId: PUBLISHED,
      publishedVersionNumber: 1,
      draftVersionId: null,
      draftVersionNumber: null,
      permissions: { canEdit: true, canReview: false, canPublish: false },
    });
    assert.equal(canCreateDraftRevision(published), true);
    assert.equal(revisionRequestSource(published), undefined);
    const presented = presentWorkflow(published);
    assert.equal(presented.primary?.id, "create-revision");
    assert.equal(presented.primary?.label, "Yeni taslak oluştur");
    assert.equal(presented.createRevisionCopy?.includes("yayında"), true);
    assert.equal(presented.publicationLabel, "Yayında");
    assert.equal(presented.workflowLabel, "Onaylandı");
  });

  it("hides new-draft creation when an active draft already exists", () => {
    const withDraft = input({
      publicationStatus: "PUBLISHED",
      workflowStatus: "DRAFT",
      publishedVersionId: PUBLISHED,
      draftVersionId: DRAFT,
      focusedVersionId: DRAFT,
      permissions: { canEdit: true, canReview: false, canPublish: false },
    });
    assert.equal(canCreateDraftRevision(withDraft), false);
    assert.equal(presentWorkflow(withDraft).primary?.id, "submit-review");
  });

  it("does not let the browser pick a historical source when a published version exists", () => {
    const HISTORICAL = "44444444-4444-4444-8444-444444444444";
    const scheduled = input({
      publicationStatus: "PUBLISHED",
      publishedVersionId: PUBLISHED,
      scheduledVersionId: DRAFT,
      draftVersionId: null,
      focusedVersionId: HISTORICAL,
      permissions: { canEdit: true, canReview: false, canPublish: true },
    });
    assert.equal(revisionRequestSource(scheduled), undefined);
    assert.equal(canCreateDraftRevision(scheduled), true);
  });

  it("uses the scheduled version as an explicit source only when nothing is published", () => {
    const scheduledOnly = input({
      publicationStatus: "NEVER_PUBLISHED",
      workflowStatus: "APPROVED",
      focusedVersionId: DRAFT,
      draftVersionId: null,
      publishedVersionId: null,
      scheduledVersionId: DRAFT,
      scheduledAt: "2026-08-20T09:00:00.000Z",
      permissions: { canEdit: true, canReview: false, canPublish: true },
    });
    assert.equal(revisionRequestSource(scheduledOnly), DRAFT);
    assert.equal(canCreateDraftRevision(scheduledOnly), true);
  });

  it("uses domain note bounds for request-changes copy, not a REJECTED status", () => {
    assert.equal(REVIEW_NOTE_MIN_LENGTH, 3);
    assert.equal(REVIEW_NOTE_MAX_LENGTH, 4000);
    const presented = presentWorkflow(
      input({
        workflowStatus: "IN_REVIEW",
        permissions: { canEdit: false, canReview: true, canPublish: false },
      }),
    );
    assert.equal(
      presented.secondary.some((action) => action.label === "Değişiklik iste"),
      true,
    );
    assert.equal(
      JSON.stringify(presented).includes("REJECTED"),
      false,
    );
  });

  it("offers unpublish only for currently published items with CONTENT_PUBLISH", () => {
    const published = input({
      publicationStatus: "PUBLISHED",
      workflowStatus: "APPROVED",
      focusedVersionId: PUBLISHED,
      publishedVersionId: PUBLISHED,
      draftVersionId: null,
      permissions: { canEdit: true, canReview: true, canPublish: true },
    });
    assert.equal(canUnpublish(published), true);
    const presented = presentWorkflow(published);
    assert.equal(presented.unpublish?.id, "unpublish");
    assert.equal(presented.unpublish?.label, UNPUBLISH_ACTION_LABEL);
    assert.equal(presented.unpublishCopy, UNPUBLISH_EFFECT_COPY);
    assert.equal(presented.primary?.id, "create-revision");
    assert.equal(presented.secondary.some((action) => action.id === "unpublish"), false);
  });

  it("does not treat CONTENT_EDIT or CONTENT_REVIEW as unpublish permission", () => {
    const editOnly = input({
      publicationStatus: "PUBLISHED",
      workflowStatus: "APPROVED",
      focusedVersionId: PUBLISHED,
      publishedVersionId: PUBLISHED,
      draftVersionId: null,
      permissions: { canEdit: true, canReview: false, canPublish: false },
    });
    const reviewOnly = input({
      publicationStatus: "PUBLISHED",
      workflowStatus: "IN_REVIEW",
      focusedVersionId: DRAFT,
      publishedVersionId: PUBLISHED,
      draftVersionId: DRAFT,
      permissions: { canEdit: false, canReview: true, canPublish: false },
    });
    assert.equal(canUnpublish(editOnly), false);
    assert.equal(canUnpublish(reviewOnly), false);
    assert.equal(presentWorkflow(editOnly).unpublish, null);
    assert.equal(presentWorkflow(reviewOnly).unpublish, null);
  });

  it("does not offer unpublish for NEVER_PUBLISHED or already UNPUBLISHED items", () => {
    assert.equal(
      canUnpublish(
        input({
          publicationStatus: "NEVER_PUBLISHED",
          permissions: { canEdit: true, canReview: true, canPublish: true },
        }),
      ),
      false,
    );
    assert.equal(
      canUnpublish(
        input({
          publicationStatus: "UNPUBLISHED",
          workflowStatus: "APPROVED",
          focusedVersionId: PUBLISHED,
          publishedVersionId: PUBLISHED,
          draftVersionId: null,
          permissions: { canEdit: true, canReview: true, canPublish: true },
        }),
      ),
      false,
    );
    assert.equal(
      presentWorkflow(
        input({
          publicationStatus: "NEVER_PUBLISHED",
          permissions: { canEdit: true, canReview: true, canPublish: true },
        }),
      ).unpublish,
      null,
    );
  });

  it("keeps a review-focused historical version read-only while still allowing item-level unpublish", () => {
    const HISTORICAL = "44444444-4444-4444-8444-444444444444";
    const reviewingHistory = input({
      publicationStatus: "PUBLISHED",
      workflowStatus: "APPROVED",
      focusedVersionId: HISTORICAL,
      focusedVersionNumber: 1,
      publishedVersionId: PUBLISHED,
      publishedVersionNumber: 2,
      draftVersionId: DRAFT,
      draftVersionNumber: 3,
      permissions: { canEdit: true, canReview: true, canPublish: true },
    });
    assert.equal(canUnpublish(reviewingHistory), true);
    assert.equal(canSubmitForReview(reviewingHistory), false);
    assert.equal(canApproveReview(reviewingHistory), false);
    const presented = presentWorkflow(reviewingHistory);
    assert.equal(presented.unpublish?.id, "unpublish");
    assert.equal(presented.primary?.id === "submit-review", false);
  });

  it("warns that a scheduled replacement remains after unpublish", () => {
    const scheduled = input({
      publicationStatus: "PUBLISHED",
      workflowStatus: "APPROVED",
      focusedVersionId: PUBLISHED,
      publishedVersionId: PUBLISHED,
      draftVersionId: null,
      scheduledVersionId: DRAFT,
      scheduledAt: "2026-08-18T11:00:00.000Z",
      permissions: { canEdit: true, canReview: false, canPublish: true },
    });
    const presented = presentWorkflow(scheduled);
    assert.equal(canUnpublish(scheduled), true);
    assert.equal(presented.unpublishScheduleWarning?.includes("zamanlamayı iptal etmez"), true);
    assert.equal(presented.scheduledRepublishNotice, null);
  });

  it("shows a future republish notice when unpublished content still has a schedule", () => {
    const unpublishedScheduled = input({
      publicationStatus: "UNPUBLISHED",
      workflowStatus: "APPROVED",
      focusedVersionId: DRAFT,
      publishedVersionId: PUBLISHED,
      draftVersionId: null,
      scheduledVersionId: DRAFT,
      scheduledAt: "2026-08-18T11:00:00.000Z",
      permissions: { canEdit: true, canReview: false, canPublish: true },
    });
    const presented = presentWorkflow(unpublishedScheduled);
    assert.equal(canUnpublish(unpublishedScheduled), false);
    assert.equal(presented.unpublish, null);
    assert.equal(presented.scheduledRepublishNotice?.includes("Şu anda yayında değil"), true);
    assert.equal(presented.scheduledRepublishNotice?.includes("yeniden yayınlanacak"), true);
  });

  it("labels republish of an unpublished approved version without inventing a new action", () => {
    const republish = input({
      publicationStatus: "UNPUBLISHED",
      workflowStatus: "APPROVED",
      focusedVersionId: PUBLISHED,
      publishedVersionId: PUBLISHED,
      draftVersionId: null,
      permissions: { canEdit: true, canReview: false, canPublish: true },
    });
    assert.equal(canPublishVersion(republish), true);
    assert.equal(presentWorkflow(republish).primary?.id, "publish");
    assert.equal(presentWorkflow(republish).primary?.label, "Yeniden yayınla");
    assert.equal(presentWorkflow(republish).unpublish, null);
  });

  it("keeps an active draft visible after unpublish eligibility is gone", () => {
    const unpublishedDraft = input({
      publicationStatus: "UNPUBLISHED",
      workflowStatus: "DRAFT",
      focusedVersionId: DRAFT,
      focusedVersionNumber: 2,
      publishedVersionId: PUBLISHED,
      publishedVersionNumber: 1,
      draftVersionId: DRAFT,
      draftVersionNumber: 2,
      permissions: { canEdit: true, canReview: false, canPublish: true },
    });
    const presented = presentWorkflow(unpublishedDraft);
    assert.equal(presented.publicationLabel, "Yayından kaldırıldı");
    assert.equal(presented.draftVersionLabel, "Sürüm 2");
    assert.equal(presented.primary?.id, "submit-review");
    assert.equal(canUnpublish(unpublishedDraft), false);
  });
});

describe("workflow mutation presentation", () => {
  it("never treats a stale-write conflict as success", () => {
    const presented = presentWorkflowFailure("CONTENT_WRITE_CONFLICT");
    assert.equal(presented.kind, "conflict");
    assert.equal(presented.message.includes("güncellendi"), true);
    assert.equal(
      isSuccessfulWorkflowResponse({ okHttp: false, okBody: false, hasData: false }),
      false,
    );
    assert.equal(
      isSuccessfulWorkflowResponse({ okHttp: true, okBody: true, hasData: false }),
      false,
    );
  });

  it("does not describe approve as publication", () => {
    assert.equal(presentWorkflowSuccess("approve").includes("Yayın ayrı"), true);
    assert.equal(presentWorkflowSuccess("approve").includes("yayınlandı"), false);
    assert.equal(presentWorkflowSuccess("publish").includes("yayınlandı"), true);
  });

  it("treats a concurrent existing draft as conflict, not success", () => {
    const presented = presentWorkflowFailure("DRAFT_ALREADY_EXISTS");
    assert.equal(presented.kind, "conflict");
    assert.equal(presented.message.includes("taslak"), true);
    assert.equal(presentWorkflowSuccess("create-revision").includes("değişmedi"), true);
  });

  it("maps unpublish domain errors without treating them as success", () => {
    const notPublished = presentWorkflowFailure("NOT_PUBLISHED");
    assert.equal(notPublished.kind, "error");
    assert.equal(notPublished.message.includes("yayında değil"), true);
    const forbidden = presentWorkflowFailure("FORBIDDEN");
    assert.equal(forbidden.kind, "error");
    assert.equal(forbidden.message.includes("yetkin yok"), true);
    const missing = presentWorkflowFailure("CONTENT_NOT_FOUND");
    assert.equal(missing.kind, "error");
    assert.equal(missing.message.includes("kapsamının dışında"), true);
    assert.equal(presentWorkflowSuccess("unpublish").includes("yayından kaldırıldı"), true);
    assert.equal(
      isSuccessfulWorkflowResponse({ okHttp: false, okBody: false, hasData: false }),
      false,
    );
  });
});
