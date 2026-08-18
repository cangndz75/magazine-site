import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveContentStatus, type ContentStatusInput } from "./status";

describe("deriveContentStatus", () => {
  it("NEVER_PUBLISHED + DRAFT", () => {
    const input: ContentStatusInput = {
      publicationStatus: "NEVER_PUBLISHED",
      workflowStatus: "DRAFT",
      publishedVersionId: null,
      draftVersionId: "v1",
      scheduledVersionId: null,
      scheduledAt: null,
      displayVersionId: "v1",
    };
    const result = deriveContentStatus(input);
    assert.equal(result.publicationLabel, "Hiç yayınlanmadı");
    assert.equal(result.publicationVariant, "neutral");
    assert.equal(result.workflowLabel, "Taslak");
    assert.equal(result.workflowVariant, "neutral");
    assert.equal(result.scheduledLabel, null);
    assert.equal(result.hasNewerDraft, false);
  });

  it("NEVER_PUBLISHED + IN_REVIEW", () => {
    const input: ContentStatusInput = {
      publicationStatus: "NEVER_PUBLISHED",
      workflowStatus: "IN_REVIEW",
      publishedVersionId: null,
      draftVersionId: "v1",
      scheduledVersionId: null,
      scheduledAt: null,
      displayVersionId: "v1",
    };
    const result = deriveContentStatus(input);
    assert.equal(result.publicationLabel, "Hiç yayınlanmadı");
    assert.equal(result.workflowLabel, "İncelemede");
    assert.equal(result.workflowVariant, "info");
    assert.equal(result.hasNewerDraft, false);
  });

  it("PUBLISHED + APPROVED (current version is published)", () => {
    const input: ContentStatusInput = {
      publicationStatus: "PUBLISHED",
      workflowStatus: "APPROVED",
      publishedVersionId: "v1",
      draftVersionId: null,
      scheduledVersionId: null,
      scheduledAt: null,
      displayVersionId: "v1",
    };
    const result = deriveContentStatus(input);
    assert.equal(result.publicationLabel, "Yayında");
    assert.equal(result.publicationVariant, "success");
    assert.equal(result.workflowLabel, "Onaylandı");
    assert.equal(result.workflowVariant, "success");
    assert.equal(result.hasNewerDraft, false);
  });

  it("PUBLISHED + newer DRAFT exists", () => {
    const input: ContentStatusInput = {
      publicationStatus: "PUBLISHED",
      workflowStatus: "DRAFT",
      publishedVersionId: "v1",
      draftVersionId: "v2",
      scheduledVersionId: null,
      scheduledAt: null,
      displayVersionId: "v2",
    };
    const result = deriveContentStatus(input);
    assert.equal(result.publicationLabel, "Yayında");
    assert.equal(result.workflowLabel, "Taslak");
    assert.equal(result.hasNewerDraft, true);
  });

  it("PUBLISHED + newer IN_REVIEW version", () => {
    const input: ContentStatusInput = {
      publicationStatus: "PUBLISHED",
      workflowStatus: "IN_REVIEW",
      publishedVersionId: "v1",
      draftVersionId: "v2",
      scheduledVersionId: null,
      scheduledAt: null,
      displayVersionId: "v2",
    };
    const result = deriveContentStatus(input);
    assert.equal(result.publicationLabel, "Yayında");
    assert.equal(result.workflowLabel, "İncelemede");
    assert.equal(result.hasNewerDraft, true);
  });

  it("UNPUBLISHED + DRAFT", () => {
    const input: ContentStatusInput = {
      publicationStatus: "UNPUBLISHED",
      workflowStatus: "DRAFT",
      publishedVersionId: null,
      draftVersionId: "v2",
      scheduledVersionId: null,
      scheduledAt: null,
      displayVersionId: "v2",
    };
    const result = deriveContentStatus(input);
    assert.equal(result.publicationLabel, "Yayından kaldırıldı");
    assert.equal(result.publicationVariant, "warning");
    assert.equal(result.workflowLabel, "Taslak");
    assert.equal(result.hasNewerDraft, false);
  });

  it("scheduled pointer present", () => {
    const input: ContentStatusInput = {
      publicationStatus: "PUBLISHED",
      workflowStatus: "APPROVED",
      publishedVersionId: "v1",
      draftVersionId: null,
      scheduledVersionId: "v2",
      scheduledAt: "2026-09-01T10:00:00Z",
      displayVersionId: "v1",
    };
    const result = deriveContentStatus(input);
    assert.equal(result.scheduledLabel, "Zamanlanmış");
    assert.equal(result.hasNewerDraft, false);
  });

  it("does not conflate publication and workflow into one enum", () => {
    const input: ContentStatusInput = {
      publicationStatus: "PUBLISHED",
      workflowStatus: "DRAFT",
      publishedVersionId: "v1",
      draftVersionId: "v2",
      scheduledVersionId: null,
      scheduledAt: null,
      displayVersionId: "v2",
    };
    const result = deriveContentStatus(input);
    assert.notEqual(result.publicationLabel, result.workflowLabel);
    assert.equal(result.publicationLabel, "Yayında");
    assert.equal(result.workflowLabel, "Taslak");
  });

  it("distinguishes never published from unpublished", () => {
    const neverPublished = deriveContentStatus({
      publicationStatus: "NEVER_PUBLISHED",
      workflowStatus: "DRAFT",
      publishedVersionId: null,
      draftVersionId: "v1",
      scheduledVersionId: null,
      scheduledAt: null,
      displayVersionId: "v1",
    });
    const unpublished = deriveContentStatus({
      publicationStatus: "UNPUBLISHED",
      workflowStatus: "APPROVED",
      publishedVersionId: "v1",
      draftVersionId: null,
      scheduledVersionId: null,
      scheduledAt: null,
      displayVersionId: "v1",
    });
    assert.equal(neverPublished.publicationLabel, "Hiç yayınlanmadı");
    assert.equal(unpublished.publicationLabel, "Yayından kaldırıldı");
    assert.notEqual(neverPublished.publicationLabel, unpublished.publicationLabel);
    assert.equal(neverPublished.publicationLabel.includes("Yayında değil"), false);
    assert.equal(unpublished.publicationLabel.includes("Yayında değil"), false);
  });

  it("scheduledAt without scheduledVersionId does not show scheduled", () => {
    const input: ContentStatusInput = {
      publicationStatus: "PUBLISHED",
      workflowStatus: "APPROVED",
      publishedVersionId: "v1",
      draftVersionId: null,
      scheduledVersionId: null,
      scheduledAt: "2026-09-01T10:00:00Z",
      displayVersionId: "v1",
    };
    const result = deriveContentStatus(input);
    assert.equal(result.scheduledLabel, null);
  });
});
