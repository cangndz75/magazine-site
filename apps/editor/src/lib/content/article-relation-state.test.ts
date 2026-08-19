import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTHOR_ROLE, ENTITY_ROLE, MEDIA_ROLE } from "@magazine/domain";
import {
  addAuthor,
  addEntity,
  addTag,
  articleEditorRelationsEqual,
  getPrimaryCategory,
  getSecondaryCategories,
  isFocusedVersionEditableDraft,
  mergeSelectedLookupOptions,
  normalizeArticleEditorRelations,
  removeTag,
  setHeroMedia,
  setPrimaryCategory,
  setSecondaryCategories,
  toDraftRelationPayload,
  type ArticleEditorRelations,
} from "./article-relation-state";

const CAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAT_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TAG_A = "11111111-1111-4111-8111-111111111111";
const TAG_B = "22222222-2222-4222-8222-222222222222";
const AUTHOR_A = "33333333-3333-4333-8333-333333333333";
const ENTITY_A = "44444444-4444-4444-8444-444444444444";
const MEDIA_A = "55555555-5555-4555-8555-555555555555";
const MEDIA_B = "66666666-6666-4666-8666-666666666666";

function empty(): ArticleEditorRelations {
  return {
    categories: [],
    authors: [],
    tags: [],
    entities: [],
    media: [],
  };
}

describe("article relation form state", () => {
  it("keeps a selected category visible when it is missing from the current lookup page", () => {
    const selected = {
      id: CAT_C,
      label: "Magazin / Televizyon",
    };
    const page = [
      { id: CAT_A, label: "Magazin" },
      { id: CAT_B, label: "Spor" },
    ];
    const merged = mergeSelectedLookupOptions([selected], page);
    assert.equal(merged[0]?.id, CAT_C);
    assert.equal(merged[0]?.label, "Magazin / Televizyon");
    assert.equal(merged.some((item) => item.id === CAT_A), true);
  });

  it("does not wipe selected options when a lookup page is empty", () => {
    const selected = [{ id: TAG_A, label: "Netflix" }];
    const merged = mergeSelectedLookupOptions(selected, []);
    assert.deepEqual(merged, selected);
  });

  it("separates primary and secondary categories and prevents duplicates", () => {
    const withPrimary = setPrimaryCategory(empty(), {
      id: CAT_A,
      name: "Magazin",
      slug: "magazin",
      parentName: null,
      isPrimary: true,
    });
    const withSecondary = setSecondaryCategories(withPrimary, [
      {
        id: CAT_A,
        name: "Magazin",
        slug: "magazin",
        parentName: null,
        isPrimary: false,
      },
      {
        id: CAT_B,
        name: "Diziler",
        slug: "diziler",
        parentName: "Magazin",
        isPrimary: false,
      },
      {
        id: CAT_B,
        name: "Diziler",
        slug: "diziler",
        parentName: "Magazin",
        isPrimary: false,
      },
    ]);

    assert.equal(getPrimaryCategory(withSecondary)?.id, CAT_A);
    assert.deepEqual(
      getSecondaryCategories(withSecondary).map((item) => item.id),
      [CAT_B],
    );
  });

  it("treats category and tag order as semantically equal", () => {
    const left = setSecondaryCategories(
      setPrimaryCategory(empty(), {
        id: CAT_A,
        name: "A",
        slug: "a",
        parentName: null,
        isPrimary: true,
      }),
      [
        { id: CAT_C, name: "C", slug: "c", parentName: null, isPrimary: false },
        { id: CAT_B, name: "B", slug: "b", parentName: null, isPrimary: false },
      ],
    );
    const right = addTag(
      addTag(
        setSecondaryCategories(
          setPrimaryCategory(empty(), {
            id: CAT_A,
            name: "A",
            slug: "a",
            parentName: null,
            isPrimary: true,
          }),
          [
            { id: CAT_B, name: "B", slug: "b", parentName: null, isPrimary: false },
            { id: CAT_C, name: "C", slug: "c", parentName: null, isPrimary: false },
          ],
        ),
        { id: TAG_B, name: "Gala", slug: "gala" },
      ),
      { id: TAG_A, name: "Netflix", slug: "netflix" },
    );
    const leftTagged = addTag(addTag(left, { id: TAG_A, name: "Netflix", slug: "netflix" }), {
      id: TAG_B,
      name: "Gala",
      slug: "gala",
    });
    assert.equal(articleEditorRelationsEqual(leftTagged, right), true);
  });

  it("marks tag, author, entity and hero changes dirty", () => {
    const baseline = empty();
    assert.equal(
      articleEditorRelationsEqual(
        addTag(baseline, { id: TAG_A, name: "Netflix", slug: "netflix" }),
        baseline,
      ),
      false,
    );
    assert.equal(
      articleEditorRelationsEqual(
        addAuthor(baseline, {
          id: AUTHOR_A,
          displayName: "Selin Yılmaz",
          slug: "selin-yilmaz",
        }),
        baseline,
      ),
      false,
    );
    assert.equal(
      articleEditorRelationsEqual(
        addEntity(baseline, {
          id: ENTITY_A,
          name: "Hande Erçel",
          kind: "PERSON",
        }),
        baseline,
      ),
      false,
    );
    assert.equal(
      articleEditorRelationsEqual(
        setHeroMedia(baseline, {
          id: MEDIA_A,
          label: "Görsel",
          mediaType: "IMAGE",
          width: 1200,
          height: 800,
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          caption: null,
          altText: null,
          credit: null,
        }),
        baseline,
      ),
      false,
    );
  });

  it("adds and removes tags without duplicates", () => {
    const once = addTag(empty(), { id: TAG_A, name: "Netflix", slug: "netflix" });
    const twice = addTag(once, { id: TAG_A, name: "Netflix", slug: "netflix" });
    assert.equal(twice.tags.length, 1);
    assert.equal(removeTag(twice, TAG_A).tags.length, 0);
  });

  it("adds and removes entities without duplicates", () => {
    const once = addEntity(empty(), {
      id: ENTITY_A,
      name: "Hande Erçel",
      kind: "PERSON",
    });
    const twice = addEntity(once, {
      id: ENTITY_A,
      name: "Hande Erçel",
      kind: "PERSON",
    });
    assert.equal(twice.entities.length, 1);
    assert.equal(twice.entities[0]?.role, ENTITY_ROLE.SUBJECT);
  });

  it("keeps hero media distinct from associated media", () => {
    const withHero = setHeroMedia(empty(), {
      id: MEDIA_A,
      label: "Kapak",
      mediaType: "IMAGE",
      width: 1200,
      height: 800,
      role: MEDIA_ROLE.HERO,
      sortOrder: 0,
      caption: "eski",
      altText: "alt",
      credit: "cred",
    });
    const replaced = setHeroMedia(withHero, {
      id: MEDIA_B,
      label: "Yeni kapak",
      mediaType: "IMAGE",
      width: 800,
      height: 600,
      role: MEDIA_ROLE.HERO,
      sortOrder: 0,
      caption: null,
      altText: null,
      credit: null,
    });
    assert.equal(replaced.media.length, 1);
    assert.equal(replaced.media[0]?.id, MEDIA_B);
    assert.equal(replaced.media[0]?.role, MEDIA_ROLE.HERO);
  });

  it("preserves media caption metadata when the same hero is kept", () => {
    const withHero = setHeroMedia(empty(), {
      id: MEDIA_A,
      label: "Kapak",
      mediaType: "IMAGE",
      width: null,
      height: null,
      role: MEDIA_ROLE.HERO,
      sortOrder: 0,
      caption: "korunmalı",
      altText: "alt",
      credit: "cred",
    });
    const same = setHeroMedia(withHero, withHero.media[0] ?? null);
    assert.equal(same.media[0]?.caption, "korunmalı");
    assert.equal(same.media[0]?.credit, "cred");
  });

  it("emits the existing draft-save relation payload shape", () => {
    const relations = addAuthor(
      addTag(
        setPrimaryCategory(empty(), {
          id: CAT_A,
          name: "Magazin",
          slug: "magazin",
          parentName: null,
          isPrimary: true,
        }),
        { id: TAG_A, name: "Netflix", slug: "netflix" },
      ),
      {
        id: AUTHOR_A,
        displayName: "Selin Yılmaz",
        slug: "selin-yilmaz",
      },
    );
    assert.deepEqual(toDraftRelationPayload(relations), {
      categories: [{ categoryId: CAT_A, isPrimary: true }],
      tags: [{ tagId: TAG_A }],
      entities: [],
      media: [],
      authors: [
        {
          authorId: AUTHOR_A,
          role: AUTHOR_ROLE.AUTHOR,
          sortOrder: 0,
        },
      ],
    });
  });

  it("only allows relation editing on the authoritative editable draft", () => {
    assert.equal(
      isFocusedVersionEditableDraft({
        canEditPermission: true,
        workflowStatus: "DRAFT",
        focusedVersionId: "v5",
        draftVersionId: "v5",
      }),
      true,
    );
    assert.equal(
      isFocusedVersionEditableDraft({
        canEditPermission: true,
        workflowStatus: "IN_REVIEW",
        focusedVersionId: "v5",
        draftVersionId: "v5",
      }),
      false,
    );
    assert.equal(
      isFocusedVersionEditableDraft({
        canEditPermission: true,
        workflowStatus: "DRAFT",
        focusedVersionId: "v4",
        draftVersionId: "v5",
      }),
      false,
    );
  });

  it("does not treat published pointer fields as part of relation dirty state", () => {
    const relations = setPrimaryCategory(empty(), {
      id: CAT_A,
      name: "Magazin",
      slug: "magazin",
      parentName: null,
      isPrimary: true,
    });
    const normalized = normalizeArticleEditorRelations(relations);
    assert.equal("publicationStatus" in normalized, false);
    assert.equal(normalized.categories[0]?.isPrimary, true);
  });
});
