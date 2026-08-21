import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DIFF_FIELD_GROUP,
  authorRoleDiffLabel,
  changeTypeLabel,
  entityRoleLabel,
  fieldGroup,
  fieldLabel,
  formatBooleanDiff,
  mediaRoleLabel,
  presentDiffSummary,
} from "./diff-presentation";

describe("revision diff presentation", () => {
  it("labels entity roles in Turkish using repository truth role values", () => {
    assert.equal(entityRoleLabel("SUBJECT"), "Ana Konu");
    assert.equal(entityRoleLabel("SECONDARY"), "İlgili");
    assert.equal(entityRoleLabel("MENTIONED"), "Bahsedilen");
  });

  it("falls back to the raw role for an unrecognized value instead of hiding it", () => {
    assert.equal(entityRoleLabel("SOMETHING_NEW"), "SOMETHING_NEW");
  });

  it("groups scalar fields into content, SEO, and source/credibility sections", () => {
    assert.equal(fieldGroup("title"), DIFF_FIELD_GROUP.CONTENT);
    assert.equal(fieldGroup("subtitle"), DIFF_FIELD_GROUP.CONTENT);
    assert.equal(fieldGroup("excerpt"), DIFF_FIELD_GROUP.CONTENT);
    assert.equal(fieldGroup("seoTitle"), DIFF_FIELD_GROUP.SEO);
    assert.equal(fieldGroup("seoDescription"), DIFF_FIELD_GROUP.SEO);
    assert.equal(fieldGroup("canonicalUrl"), DIFF_FIELD_GROUP.SEO);
    assert.equal(fieldGroup("robots"), DIFF_FIELD_GROUP.SEO);
    assert.equal(fieldGroup("credibility"), DIFF_FIELD_GROUP.SOURCE);
    assert.equal(fieldGroup("sourceUrl"), DIFF_FIELD_GROUP.SOURCE);
    assert.equal(fieldGroup("syndicated"), DIFF_FIELD_GROUP.SOURCE);
  });

  it("labels author and media roles without leaking internal enum casing to the user", () => {
    assert.equal(authorRoleDiffLabel("AUTHOR"), "Yazar");
    assert.equal(authorRoleDiffLabel("CONTRIBUTOR"), "Katkıda bulunan");
    assert.equal(mediaRoleLabel("HERO"), "Kahraman görsel");
    assert.equal(mediaRoleLabel("GALLERY"), "Galeri");
  });

  it("has a stable Turkish label for every change type", () => {
    assert.equal(changeTypeLabel("ADDED"), "Eklendi");
    assert.equal(changeTypeLabel("REMOVED"), "Kaldırıldı");
    assert.equal(changeTypeLabel("MODIFIED"), "Değişti");
    assert.equal(changeTypeLabel("MOVED"), "Taşındı");
  });

  it("does not fabricate a field label for an unknown field", () => {
    assert.equal(fieldLabel("madeUpField"), "Alan");
  });

  it("renders boolean and empty scalar diffs without raw JS values leaking through", () => {
    assert.equal(formatBooleanDiff(true), "Evet");
    assert.equal(formatBooleanDiff(false), "Hayır");
    assert.equal(formatBooleanDiff(null), "—");
    assert.equal(formatBooleanDiff(""), "—");
    assert.equal(formatBooleanDiff("Merhaba"), "Merhaba");
  });

  it("mentions video changes in the summary only when the DTO reports them", () => {
    const base = {
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
      tagsAdded: 0,
      tagsRemoved: 0,
      entitiesChanged: false,
      mediaChanged: false,
      authorsChanged: false,
    };
    assert.equal(presentDiffSummary({ ...base, videosChanged: true }).includes("Video değişti."), true);
    assert.equal(
      presentDiffSummary({ ...base, videosChanged: false }).includes("Video değişti."),
      false,
    );
  });

  it("reports no visible difference for a version compared to itself", () => {
    assert.deepEqual(
      presentDiffSummary({
        changed: false,
        scalarFieldsChanged: 0,
        blocksAdded: 0,
        blocksRemoved: 0,
        blocksModified: 0,
        blocksMoved: 0,
        bodyDetailLimited: false,
        categoriesAdded: 0,
        categoriesRemoved: 0,
        primaryCategoryChanged: false,
        tagsAdded: 0,
        tagsRemoved: 0,
        entitiesChanged: false,
        mediaChanged: false,
        authorsChanged: false,
      }),
      ["Bu iki sürüm arasında görünür bir fark yok."],
    );
  });
});
