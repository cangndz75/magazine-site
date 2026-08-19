import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReviewPageSearchParams } from "./review-page-params";
import {
  presentDiffSummary,
  fieldLabel,
} from "./diff-presentation";
import {
  PUBLICATION_STATUS_LABELS,
  WORKFLOW_STATUS_LABELS,
  revisionPointerLabels,
} from "./revision-presentation";

describe("review page params", () => {
  it("parses category and author filters and ignores invalid ids", () => {
    const id = "01234567-89ab-cdef-0123-456789abcdef";
    const valid = parseReviewPageSearchParams({
      categoryId: id,
      authorId: id,
      publicationStatus: "PUBLISHED",
    });
    assert.equal(valid.categoryId, id);
    assert.equal(valid.authorId, id);
    assert.equal(valid.publicationStatus, "PUBLISHED");

    const invalid = parseReviewPageSearchParams({
      categoryId: "nope",
      authorId: "nope",
    });
    assert.equal(invalid.categoryId, undefined);
    assert.equal(invalid.authorId, undefined);
  });
});

describe("workflow and publication presentation", () => {
  it("keeps publication and workflow labels on separate axes", () => {
    assert.equal(PUBLICATION_STATUS_LABELS.NEVER_PUBLISHED, "Hiç yayınlanmadı");
    assert.equal(PUBLICATION_STATUS_LABELS.PUBLISHED, "Yayında");
    assert.equal(PUBLICATION_STATUS_LABELS.UNPUBLISHED, "Yayından kaldırıldı");
    assert.notEqual(
      PUBLICATION_STATUS_LABELS.NEVER_PUBLISHED,
      PUBLICATION_STATUS_LABELS.UNPUBLISHED,
    );
    assert.equal(WORKFLOW_STATUS_LABELS.DRAFT, "Taslak");
    assert.notEqual(
      PUBLICATION_STATUS_LABELS.PUBLISHED,
      WORKFLOW_STATUS_LABELS.DRAFT,
    );
  });

  it("marks current/published/scheduled revisions without raw ids", () => {
    const labels = revisionPointerLabels({
      id: "01234567-89ab-cdef-0123-456789abcdef",
      versionNumber: 3,
      workflowStatus: "DRAFT",
      title: "Başlık",
      createdAt: "2026-08-17T10:00:00.000Z",
      isCurrentDraft: true,
      isScheduledVersion: false,
      isPublishedVersion: true,
    });
    assert.deepEqual(labels, ["Yayındaki", "Güncel taslak"]);
  });
});

describe("semantic diff presentation", () => {
  it("describes editorial changes instead of dumping json", () => {
    const lines = presentDiffSummary({
      changed: true,
      scalarFieldsChanged: 2,
      blocksAdded: 1,
      blocksRemoved: 0,
      blocksModified: 1,
      blocksMoved: 0,
      bodyDetailLimited: false,
      categoriesAdded: 0,
      categoriesRemoved: 0,
      primaryCategoryChanged: true,
      tagsAdded: 0,
      tagsRemoved: 0,
      entitiesChanged: false,
      mediaChanged: false,
      authorsChanged: true,
    });
    assert.equal(lines.some((line) => line.includes("2 alan değişti")), true);
    assert.equal(lines.some((line) => line.includes("Ana kategori değişti")), true);
    assert.equal(JSON.stringify(lines).includes("{"), false);
    assert.equal(fieldLabel("title"), "Başlık");
  });

  it("names tag and entity relation changes without ids", () => {
    const lines = presentDiffSummary({
      changed: true,
      scalarFieldsChanged: 0,
      blocksAdded: 0,
      blocksRemoved: 0,
      blocksModified: 0,
      blocksMoved: 0,
      bodyDetailLimited: false,
      categoriesAdded: 0,
      categoriesRemoved: 0,
      primaryCategoryChanged: false,
      tagsAdded: 1,
      tagsRemoved: 1,
      entitiesChanged: true,
      mediaChanged: true,
      authorsChanged: false,
    });
    assert.equal(lines.some((line) => line.includes("Etiketler değişti")), true);
    assert.equal(lines.some((line) => line.includes("İlişkili kişiler")), true);
    assert.equal(lines.some((line) => line.includes("Kapak ve bağlı medya")), true);
    assert.equal(JSON.stringify(lines).includes("categoryId"), false);
  });
});
