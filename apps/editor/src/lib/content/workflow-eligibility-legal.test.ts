import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canPublishVersion,
  canUnpublish,
  presentWorkflow,
} from "./workflow-eligibility";

const basePermissions = {
  canEdit: true,
  canReview: true,
  canPublish: true,
};

const baseInput = {
  contentItemId: "item-1",
  publicationStatus: "PUBLISHED" as const,
  workflowStatus: "APPROVED" as const,
  focusedVersionId: "version-1",
  focusedVersionNumber: 2,
  draftVersionId: null,
  publishedVersionId: "version-1",
  scheduledVersionId: null,
  scheduledAt: null,
  publishedVersionNumber: 2,
  draftVersionNumber: null,
  scheduledVersionNumber: null,
  categories: [{ isPrimary: true }],
  permissions: basePermissions,
  isDirty: false,
  hasConcurrencyToken: true,
  legalHoldAt: null,
  retractedAt: null,
  takedownAt: null,
};

describe("workflow eligibility with legal hold", () => {
  it("blocks publish and unpublish while legal hold is active", () => {
    const held = {
      ...baseInput,
      legalHoldAt: "2026-03-01T10:00:00.000Z",
    };
    assert.equal(canPublishVersion(held), false);
    assert.equal(canUnpublish(held), false);
    const presented = presentWorkflow(held);
    assert.match(presented.legalHoldNotice ?? "", /Legal hold aktif/i);
  });
});
