import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PUBLISHING_ERROR } from "../publishing/errors";
import { diffContentVersions } from "./content-diff";
import { DIFF_MAX_BLOCKS, DIFF_MAX_INLINE_TOKENS, type DiffContentVersionsInput } from "./diff-types";
import { tokenizeEditorialText } from "./diff-text";

const ITEM = "11111111-1111-4111-8111-111111111111";
const FROM = "22222222-2222-4222-8222-222222222222";
const TO = "33333333-3333-4333-8333-333333333333";
const CREATED = new Date("2026-08-16T12:00:00.000Z");

function side(
  id: string,
  overrides: Partial<DiffContentVersionsInput["from"]> = {},
): DiffContentVersionsInput["from"] {
  return {
    id,
    versionNumber: id === FROM ? 1 : 2,
    workflowStatus: "DRAFT",
    createdAt: CREATED,
    isCurrentDraft: false,
    isPublishedVersion: false,
    isScheduledVersion: false,
    title: "Title",
    subtitle: null,
    excerpt: null,
    seoTitle: null,
    seoDescription: null,
    canonicalUrl: null,
    robots: null,
    credibility: null,
    credibilitySource: null,
    source: null,
    sourceOrganization: null,
    sourceUrl: null,
    syndicated: false,
    isMaterialUpdate: false,
    body: { blocks: [{ type: "paragraph", text: "Hello world" }] },
    categories: [],
    tags: [],
    entities: [],
    media: [],
    videos: [],
    authors: [],
    ...overrides,
  };
}

function diff(
  fromOverrides: Partial<DiffContentVersionsInput["from"]> = {},
  toOverrides: Partial<DiffContentVersionsInput["from"]> = {},
) {
  const result = diffContentVersions({
    contentItemId: ITEM,
    from: side(FROM, fromOverrides),
    to: side(TO, toOverrides),
  });
  if (!result.ok) {
    throw new Error(result.code);
  }
  return result.value;
}

describe("scalar field diff", () => {
  it("returns an empty unchanged comparison, including a version against itself", () => {
    const same = diff();
    assert.equal(same.summary.changed, false);
    assert.deepEqual(same.fields, []);
    assert.equal(same.body.changed, false);

    const self = diffContentVersions({
      contentItemId: ITEM,
      from: side(FROM),
      to: side(FROM),
    });
    assert.equal(self.ok, true);
    if (self.ok) {
      assert.equal(self.value.summary.changed, false);
    }
  });

  it("reports added, removed, and modified scalars without unchanged fields", () => {
    const result = diff(
      { title: "Old", excerpt: "spot", subtitle: "keep" },
      { title: "New", excerpt: null, seoTitle: "SEO", subtitle: "keep" },
    );
    assert.deepEqual(
      result.fields.map((field) => [field.field, field.changeType]),
      [
        ["title", "MODIFIED"],
        ["excerpt", "REMOVED"],
        ["seoTitle", "ADDED"],
      ],
    );
    assert.equal(result.fields.some((field) => field.field === "subtitle"), false);
    assert.equal(result.summary.scalarFieldsChanged, 3);
  });

  it("treats stored nulls as equal and does not trim beyond persisted values", () => {
    const result = diff({ excerpt: null }, { excerpt: null });
    assert.equal(result.fields.some((field) => field.field === "excerpt"), false);
    const spaces = diff({ title: "John Doe" }, { title: "John Doe " });
    assert.equal(
      spaces.fields.find((field) => field.field === "title")?.changeType,
      "MODIFIED",
    );
  });
});

describe("body block diff", () => {
  it("treats identical bodies as unchanged", () => {
    const result = diff();
    assert.equal(result.body.changed, false);
    assert.deepEqual(result.body.blocks, []);
  });

  it("detects paragraph add, remove, and modify", () => {
    const added = diff(
      { body: { blocks: [{ type: "paragraph", text: "A" }] } },
      {
        body: {
          blocks: [
            { type: "paragraph", text: "A" },
            { type: "paragraph", text: "B" },
          ],
        },
      },
    );
    assert.equal(added.body.blocks.length, 1);
    assert.equal(added.body.blocks[0]?.changeType, "ADDED");
    assert.equal(added.body.blocks[0]?.afterText, "B");

    const removed = diff(
      {
        body: {
          blocks: [
            { type: "paragraph", text: "A" },
            { type: "paragraph", text: "B" },
          ],
        },
      },
      { body: { blocks: [{ type: "paragraph", text: "A" }] } },
    );
    assert.equal(removed.body.blocks[0]?.changeType, "REMOVED");

    const modified = diff(
      { body: { blocks: [{ type: "paragraph", text: "Hello world" }] } },
      { body: { blocks: [{ type: "paragraph", text: "Hello friends" }] } },
    );
    assert.equal(modified.body.blocks[0]?.changeType, "MODIFIED");
  });

  it("does not mark later blocks modified when a paragraph is inserted in the middle", () => {
    const result = diff(
      {
        body: {
          blocks: [
            { type: "paragraph", text: "one" },
            { type: "paragraph", text: "two" },
            { type: "paragraph", text: "three" },
          ],
        },
      },
      {
        body: {
          blocks: [
            { type: "paragraph", text: "one" },
            { type: "paragraph", text: "inserted" },
            { type: "paragraph", text: "two" },
            { type: "paragraph", text: "three" },
          ],
        },
      },
    );
    assert.deepEqual(
      result.body.blocks.map((block) => block.changeType),
      ["ADDED"],
    );
    assert.equal(result.body.blocks[0]?.afterText, "inserted");
    assert.equal(result.summary.blocksAdded, 1);
    assert.equal(result.summary.blocksModified, 0);
  });

  it("reports a unique identical block as MOVED instead of remove+add", () => {
    const result = diff(
      {
        body: {
          blocks: [
            { type: "paragraph", text: "alpha" },
            { type: "paragraph", text: "beta" },
            { type: "paragraph", text: "gamma" },
          ],
        },
      },
      {
        body: {
          blocks: [
            { type: "paragraph", text: "beta" },
            { type: "paragraph", text: "alpha" },
            { type: "paragraph", text: "gamma" },
          ],
        },
      },
    );
    assert.equal(result.body.blocks.some((block) => block.changeType === "MOVED"), true);
    assert.equal(result.body.blocks.some((block) => block.changeType === "ADDED"), false);
    assert.equal(result.body.blocks.some((block) => block.changeType === "REMOVED"), false);
  });

  it("does not claim MOVE for duplicate similar blocks", () => {
    const result = diff(
      {
        body: {
          blocks: [
            { type: "paragraph", text: "same" },
            { type: "paragraph", text: "same" },
          ],
        },
      },
      {
        body: {
          blocks: [
            { type: "paragraph", text: "other" },
            { type: "paragraph", text: "same" },
            { type: "paragraph", text: "same" },
          ],
        },
      },
    );
    assert.equal(result.body.blocks.some((block) => block.changeType === "MOVED"), false);
    assert.equal(result.body.blocks.some((block) => block.changeType === "ADDED"), true);
  });

  it("uses stable block ids for move detection when present", () => {
    const result = diff(
      {
        body: {
          blocks: [
            { id: "a", type: "paragraph", text: "A" },
            { id: "b", type: "paragraph", text: "B" },
          ],
        },
      },
      {
        body: {
          blocks: [
            { id: "b", type: "paragraph", text: "B" },
            { id: "a", type: "paragraph", text: "A" },
          ],
        },
      },
    );
    assert.equal(result.body.blocks.length, 2);
    assert.equal(
      result.body.blocks.every((block) => block.changeType === "MOVED"),
      true,
    );
  });

  it("handles an empty document and unknown blocks without crashing", () => {
    const empty = diff({ body: { blocks: [] } }, { body: { blocks: [] } });
    assert.equal(empty.body.changed, false);

    const unknown = diff(
      { body: { blocks: [{ type: "custom-deck", payload: { k: 1 } }] } },
      { body: { blocks: [{ type: "custom-deck", payload: { k: 2 } }] } },
    );
    assert.equal(unknown.body.blocks[0]?.changeType, "MODIFIED");
    assert.equal(unknown.body.blocks[0]?.blockType, "custom-deck");
  });

  it("treats a link href change as a modification even when visible text matches", () => {
    const result = diff(
      {
        body: {
          blocks: [
            {
              type: "paragraph",
              text: "Read more",
              href: "https://example.com/a",
            },
          ],
        },
      },
      {
        body: {
          blocks: [
            {
              type: "paragraph",
              text: "Read more",
              href: "https://example.com/b",
            },
          ],
        },
      },
    );
    assert.equal(result.body.blocks[0]?.changeType, "MODIFIED");
    assert.equal(result.body.blocks[0]?.links?.changed, true);
  });

  it("treats mark-only changes as body modifications", () => {
    const result = diff(
      {
        body: {
          blocks: [
            {
              type: "paragraph",
              content: [{ text: "Same visible text" }],
            },
          ],
        },
      },
      {
        body: {
          blocks: [
            {
              type: "paragraph",
              content: [
                { text: "Same visible text", marks: [{ type: "bold" }] },
              ],
            },
          ],
        },
      },
    );
    assert.equal(result.body.changed, true);
    assert.equal(result.body.blocks[0]?.changeType, "MODIFIED");
  });

  it("treats canonical inline href-only changes as body modifications", () => {
    const result = diff(
      {
        body: {
          blocks: [
            {
              type: "paragraph",
              content: [
                {
                  text: "Same visible text",
                  marks: [{ type: "link", href: "https://example.com/a" }],
                },
              ],
            },
          ],
        },
      },
      {
        body: {
          blocks: [
            {
              type: "paragraph",
              content: [
                {
                  text: "Same visible text",
                  marks: [{ type: "link", href: "https://example.com/b" }],
                },
              ],
            },
          ],
        },
      },
    );
    assert.equal(result.body.changed, true);
    assert.equal(result.body.blocks[0]?.changeType, "MODIFIED");
    assert.equal(result.body.blocks[0]?.links?.changed, true);
  });

  it("rejects corrupt persisted bodies safely", () => {
    const result = diffContentVersions({
      contentItemId: ITEM,
      from: side(FROM, { body: "not-json-structure" }),
      to: side(TO),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.CONTENT_BODY_CORRUPT);
    }
  });
});

describe("inline text diff", () => {
  it("reports word addition, removal, and replacement", () => {
    const added = diff(
      { body: { blocks: [{ type: "paragraph", text: "Hello world" }] } },
      { body: { blocks: [{ type: "paragraph", text: "Hello brave world" }] } },
    );
    const parts = added.body.blocks[0]?.inlineChanges ?? [];
    assert.equal(parts.some((part) => part.type === "EQUAL" && part.text.includes("Hello")), true);
    assert.equal(parts.some((part) => part.type === "ADDED" && part.text.includes("brave")), true);
    assert.equal(parts.some((part) => part.type === "EQUAL" && part.text.includes("world")), true);
    assert.equal(parts.some((part) => part.type === "REMOVED"), false);

    const removed = diff(
      { body: { blocks: [{ type: "paragraph", text: "Hello brave world" }] } },
      { body: { blocks: [{ type: "paragraph", text: "Hello world" }] } },
    );
    assert.equal(
      removed.body.blocks[0]?.inlineChanges?.some(
        (part) => part.type === "REMOVED" && part.text.includes("brave"),
      ),
      true,
    );

    const replaced = diff(
      { body: { blocks: [{ type: "paragraph", text: "Hello world." }] } },
      { body: { blocks: [{ type: "paragraph", text: "Hello world!" }] } },
    );
    assert.equal(
      replaced.body.blocks[0]?.inlineChanges?.some((part) => part.type === "REMOVED" && part.text === "."),
      true,
    );
    assert.equal(
      replaced.body.blocks[0]?.inlineChanges?.some((part) => part.type === "ADDED" && part.text === "!"),
      true,
    );
  });

  it("preserves Turkish characters as whole tokens", () => {
    assert.deepEqual(tokenizeEditorialText("ışık"), ["ışık"]);
    const result = diff(
      { body: { blocks: [{ type: "paragraph", text: "Güneş doğdu" }] } },
      { body: { blocks: [{ type: "paragraph", text: "Güneş battı" }] } },
    );
    assert.equal(
      result.body.blocks[0]?.inlineChanges?.some(
        (part) => part.type === "REMOVED" && part.text === "doğdu",
      ),
      true,
    );
    assert.equal(
      result.body.blocks[0]?.inlineChanges?.some(
        (part) => part.type === "ADDED" && part.text === "battı",
      ),
      true,
    );
  });

  it("omits inline changes for oversized text instead of failing the diff", () => {
    const huge = "word ".repeat(DIFF_MAX_INLINE_TOKENS + 10);
    const result = diff(
      { body: { blocks: [{ type: "paragraph", text: huge }] } },
      { body: { blocks: [{ type: "paragraph", text: `${huge} extra` }] } },
    );
    assert.equal(result.body.blocks[0]?.changeType, "MODIFIED");
    assert.equal(result.body.blocks[0]?.inlineChanges, undefined);
    assert.equal(result.body.blocks[0]?.inlineDetailLimited, true);
    assert.equal(result.summary.changed, true);
  });

  it("falls back to a coarse document diff when block count exceeds the bound", () => {
    const many = Array.from({ length: DIFF_MAX_BLOCKS + 1 }, (_, index) => ({
      type: "paragraph",
      text: `block-${index}`,
    }));
    const result = diff(
      { body: { blocks: many } },
      { body: { blocks: [...many, { type: "paragraph", text: "tail" }] } },
    );
    assert.equal(result.body.detailLimited, true);
    assert.equal(result.summary.bodyDetailLimited, true);
    assert.equal(result.summary.changed, true);
  });
});

describe("relation diff", () => {
  it("distinguishes primary category changes from secondary add/remove", () => {
    const result = diff(
      {
        categories: [
          { id: "a", name: "A", slug: "a", isPrimary: true },
          { id: "s", name: "S", slug: "s", isPrimary: false },
        ],
      },
      {
        categories: [
          { id: "b", name: "B", slug: "b", isPrimary: true },
          { id: "s", name: "S", slug: "s", isPrimary: false },
        ],
      },
    );
    assert.equal(result.relations.categories.primary.changed, true);
    assert.equal(result.relations.categories.primary.before?.id, "a");
    assert.equal(result.relations.categories.primary.after?.id, "b");
    assert.deepEqual(
      result.relations.categories.added.map((item) => item.id),
      ["b"],
    );
    assert.deepEqual(
      result.relations.categories.removed.map((item) => item.id),
      ["a"],
    );
    assert.equal(result.summary.primaryCategoryChanged, true);
  });

  it("diffs tags by id", () => {
    const result = diff(
      { tags: [{ id: "t1", name: "One", slug: "one" }] },
      { tags: [{ id: "t2", name: "Two", slug: "two" }] },
    );
    assert.equal(result.relations.tags.added[0]?.id, "t2");
    assert.equal(result.relations.tags.removed[0]?.id, "t1");
  });

  it("preserves entity role metadata and reports role changes", () => {
    const result = diff(
      {
        entities: [
          { id: "e1", name: "Ada", role: "SUBJECT", sortOrder: 0 },
        ],
      },
      {
        entities: [
          { id: "e1", name: "Ada", role: "MENTIONED", sortOrder: 0 },
          { id: "e2", name: "Bob", role: "SECONDARY", sortOrder: 1 },
        ],
      },
    );
    assert.equal(result.relations.entities.modified[0]?.beforeRole, "SUBJECT");
    assert.equal(result.relations.entities.added[0]?.id, "e2");
    assert.equal(result.summary.entitiesChanged, true);
  });

  it("reports media metadata and ordering changes", () => {
    const result = diff(
      {
        media: [
          {
            id: "m1",
            label: "Hero",
            role: "HERO",
            sortOrder: 0,
            caption: "old",
            altText: "alt",
            credit: null,
          },
          {
            id: "m2",
            label: "Inline",
            role: "INLINE",
            sortOrder: 1,
            caption: null,
            altText: null,
            credit: null,
          },
        ],
      },
      {
        media: [
          {
            id: "m2",
            label: "Inline",
            role: "INLINE",
            sortOrder: 0,
            caption: null,
            altText: null,
            credit: null,
          },
          {
            id: "m1",
            label: "Hero",
            role: "HERO",
            sortOrder: 1,
            caption: "new",
            altText: "alt",
            credit: null,
          },
        ],
      },
    );
    assert.equal(result.relations.media.reordered, true);
    assert.equal(result.relations.media.modified[0]?.before.caption, "old");
    assert.equal(result.relations.media.modified[0]?.after.caption, "new");
  });

  it("reports video add/remove and caption changes without exposing rights internals", () => {
    const result = diff(
      {
        videos: [
          {
            id: "v1",
            label: "Interview clip",
            provider: "YOUTUBE",
            sortOrder: 0,
            caption: "old caption",
            durationSeconds: 120,
          },
        ],
      },
      {
        videos: [
          {
            id: "v1",
            label: "Interview clip",
            provider: "YOUTUBE",
            sortOrder: 0,
            caption: "new caption",
            durationSeconds: 120,
          },
          {
            id: "v2",
            label: "Behind the scenes",
            provider: "VIMEO",
            sortOrder: 1,
            caption: null,
            durationSeconds: 45,
          },
        ],
      },
    );
    assert.equal(result.relations.videos.added.length, 1);
    assert.equal(result.relations.videos.added[0]?.id, "v2");
    assert.equal(result.relations.videos.modified.length, 1);
    assert.equal(result.relations.videos.modified[0]?.before.caption, "old caption");
    assert.equal(result.relations.videos.modified[0]?.after.caption, "new caption");
    assert.equal(result.summary.videosChanged, true);
    assert.equal(JSON.stringify(result).includes("rightsNote"), false);
    assert.equal(JSON.stringify(result).includes("submittedUrl"), false);
  });

  it("does not report a video change when nothing about the video changed", () => {
    const same = diff(
      {
        videos: [
          {
            id: "v1",
            label: "Clip",
            provider: "YOUTUBE",
            sortOrder: 0,
            caption: "same",
            durationSeconds: 30,
          },
        ],
      },
      {
        videos: [
          {
            id: "v1",
            label: "Clip",
            provider: "YOUTUBE",
            sortOrder: 0,
            caption: "same",
            durationSeconds: 30,
          },
        ],
      },
    );
    assert.equal(same.relations.videos.added.length, 0);
    assert.equal(same.relations.videos.removed.length, 0);
    assert.equal(same.relations.videos.modified.length, 0);
    assert.equal(same.relations.videos.reordered, false);
    assert.equal(same.summary.videosChanged, false);
  });

  it("reports author add/remove and role changes", () => {
    const result = diff(
      {
        authors: [
          { id: "a1", displayName: "Ann", slug: "ann", role: "AUTHOR", sortOrder: 0 },
          { id: "a2", displayName: "Bob", slug: "bob", role: "CONTRIBUTOR", sortOrder: 1 },
        ],
      },
      {
        authors: [
          { id: "a2", displayName: "Bob", slug: "bob", role: "AUTHOR", sortOrder: 0 },
          { id: "a3", displayName: "Cyd", slug: "cyd", role: "AUTHOR", sortOrder: 1 },
        ],
      },
    );
    assert.equal(result.relations.authors.removed[0]?.id, "a1");
    assert.equal(result.relations.authors.added[0]?.id, "a3");
    assert.equal(result.relations.authors.modified[0]?.afterRole, "AUTHOR");
    assert.equal(result.summary.authorsChanged, true);
  });

  it("reports byline order changes among surviving authors", () => {
    const result = diff(
      {
        authors: [
          { id: "a1", displayName: "Ann", slug: "ann", role: "AUTHOR", sortOrder: 0 },
          { id: "a2", displayName: "Bob", slug: "bob", role: "AUTHOR", sortOrder: 1 },
        ],
      },
      {
        authors: [
          { id: "a2", displayName: "Bob", slug: "bob", role: "AUTHOR", sortOrder: 0 },
          { id: "a1", displayName: "Ann", slug: "ann", role: "AUTHOR", sortOrder: 1 },
        ],
      },
    );
    assert.equal(result.relations.authors.reordered, true);
    assert.deepEqual(result.relations.authors.beforeOrder, ["a1", "a2"]);
    assert.deepEqual(result.relations.authors.afterOrder, ["a2", "a1"]);
  });
});
