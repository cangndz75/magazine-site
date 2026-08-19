import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAuthorLabel,
  formatCategoryLabel,
  formatEditorMediaLabel,
  formatEntityLabel,
  toAuthorPickerOption,
  toCategoryPickerOption,
  toMediaPickerOption,
} from "./lookup-labels";

describe("lookup labels", () => {
  it("shows hierarchy without exposing ids", () => {
    assert.equal(
      formatCategoryLabel({ name: "Dizi", parentName: "Magazin" }),
      "Magazin / Dizi",
    );
    assert.equal(formatCategoryLabel({ name: "Spor", parentName: null }), "Spor");
  });

  it("uses display name for authors", () => {
    assert.equal(formatAuthorLabel({ displayName: "Ayşe Kaya" }), "Ayşe Kaya");
  });

  it("maps picker options from safe lookup fields", () => {
    const category = toCategoryPickerOption({
      id: "01234567-89ab-cdef-0123-456789abcdef",
      name: "Dizi",
      slug: "dizi",
      parentId: "abcdef01-2345-6789-abcd-ef0123456789",
      parentName: "Magazin",
    });
    assert.equal(category.label, "Magazin / Dizi");
    assert.equal(category.description, "dizi");

    const author = toAuthorPickerOption({
      id: "01234567-89ab-cdef-0123-456789abcdef",
      displayName: "Ayşe Kaya",
      slug: "ayse-kaya",
    });
    assert.equal(author.label, "Ayşe Kaya");
    assert.equal(author.description, "ayse-kaya");
  });

  it("shows entity type without exposing ids", () => {
    assert.equal(
      formatEntityLabel({ name: "Hande Erçel", kind: "PERSON" }),
      "Hande Erçel · Kişi",
    );
  });

  it("labels media without storage keys", () => {
    const label = formatEditorMediaLabel({
      mediaType: "IMAGE",
      width: 1200,
      height: 800,
    });
    assert.equal(label, "Görsel · 1200×800");
    assert.equal(label.includes("/"), false);
    const option = toMediaPickerOption({
      id: "01234567-89ab-cdef-0123-456789abcdef",
      label,
      mediaType: "IMAGE",
      width: 1200,
      height: 800,
    });
    assert.equal(option.label, "Görsel · 1200×800");
    assert.equal(JSON.stringify(option).includes("storage"), false);
  });
});
