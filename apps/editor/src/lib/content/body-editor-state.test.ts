import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bodyEditorDocumentsEqual,
  bodyToEditorDocument,
  cloneBodyEditorDocument,
  editorDocumentToTiptapDocument,
  editorDocumentToBody,
  tiptapDocumentToEditorDocument,
  type BodyEditorDocument,
} from "./body-editor-state";

describe("structured body editor adapter", () => {
  it("opens an empty body as a usable placeholder without body churn", () => {
    const parsed = bodyToEditorDocument({ blocks: [] });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(editorDocumentToBody(parsed.document), { blocks: [] });
  });

  it("round-trips a paragraph", () => {
    const body = { blocks: [{ type: "paragraph", text: "Merhaba dünya" }] };
    const parsed = bodyToEditorDocument(body);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(editorDocumentToBody(parsed.document), body);
  });

  it("round-trips a heading", () => {
    const body = { blocks: [{ type: "heading", level: 2, text: "Ara başlık" }] };
    const parsed = bodyToEditorDocument(body);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(editorDocumentToBody(parsed.document), body);
  });

  it("round-trips bold inline content", () => {
    const body = {
      blocks: [
        {
          type: "paragraph",
          content: [{ text: "Kalın", marks: [{ type: "bold" }] }],
        },
      ],
    };
    const parsed = bodyToEditorDocument(body);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(editorDocumentToBody(parsed.document), body);
  });

  it("round-trips italic inline content", () => {
    const body = {
      blocks: [
        {
          type: "paragraph",
          content: [{ text: "İtalik", marks: [{ type: "italic" }] }],
        },
      ],
    };
    const parsed = bodyToEditorDocument(body);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(editorDocumentToBody(parsed.document), body);
  });

  it("round-trips overlapping bold and italic marks", () => {
    const body = {
      blocks: [
        {
          type: "paragraph",
          content: [
            { text: "Vurgu", marks: [{ type: "bold" }, { type: "italic" }] },
          ],
        },
      ],
    };
    const parsed = bodyToEditorDocument(body);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(editorDocumentToBody(parsed.document), body);
  });

  it("round-trips link inline content", () => {
    const body = {
      blocks: [
        {
          type: "paragraph",
          content: [
            {
              text: "Kaynak",
              marks: [{ type: "link", href: "https://example.com/haber" }],
            },
          ],
        },
      ],
    };
    const parsed = bodyToEditorDocument(body);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(editorDocumentToBody(parsed.document), body);
  });

  it("round-trips paragraph and heading sequences with Turkish text", () => {
    const body = {
      blocks: [
        { type: "paragraph", text: "Güneş Kıbrıs üzerinde doğdu." },
        { type: "heading", level: 3, text: "Editör notu" },
        { type: "paragraph", text: "İçerik akışı korunur." },
      ],
    };
    const parsed = bodyToEditorDocument(body);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(editorDocumentToBody(parsed.document), body);
  });

  it("keeps old 3A text bodies in the old representation after round trip", () => {
    const body = {
      blocks: [
        { type: "paragraph", text: "Eski paragraf" },
        { type: "heading", level: 3, text: "Eski başlık" },
      ],
    };
    const parsed = bodyToEditorDocument(body);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(editorDocumentToBody(parsed.document), body);
  });

  it("keeps semantically unchanged round trips equal", () => {
    const parsed = bodyToEditorDocument({
      blocks: [{ id: "block-a", type: "paragraph", text: "A" }],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const cloned = cloneBodyEditorDocument(parsed.document);
    assert.equal(bodyEditorDocumentsEqual(parsed.document, cloned), true);
  });

  it("fails safely for malformed persisted content", () => {
    const parsed = bodyToEditorDocument("not structured");
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.reason, "malformed");
  });

  it("does not silently drop unsupported valid blocks", () => {
    const parsed = bodyToEditorDocument({
      blocks: [{ type: "custom-deck", payload: { title: "Deck" } }],
    });
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.reason, "unsupported");
  });

  it("does not silently strip supported marks or rich text structures", () => {
    const parsed = bodyToEditorDocument({
      blocks: [
        {
          type: "paragraph",
          content: [{ text: "Marked", marks: [{ type: "bold" }] }],
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(editorDocumentToBody(parsed.document), {
      blocks: [
        {
          type: "paragraph",
          content: [{ text: "Marked", marks: [{ type: "bold" }] }],
        },
      ],
    });
  });

  it("rejects unsafe javascript links", () => {
    const parsed = bodyToEditorDocument({
      blocks: [
        {
          type: "paragraph",
          content: [
            { text: "Bad", marks: [{ type: "link", href: "javascript:alert(1)" }] },
          ],
        },
      ],
    });
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.reason, "unsupported");
  });

  it("fails safely for malformed rich content", () => {
    const parsed = bodyToEditorDocument({
      blocks: [{ type: "paragraph", content: [{ marks: [{ type: "bold" }] }] }],
    });
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.reason, "malformed");
  });

  it("converts TipTap JSON through the canonical adapter without editor metadata", () => {
    const parsed = tiptapDocumentToEditorDocument({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Türkçe " },
            {
              type: "text",
              text: "bağlantı",
              marks: [
                { type: "bold" },
                { type: "link", attrs: { href: "https://example.com" } },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(editorDocumentToBody(parsed.document), {
      blocks: [
        {
          type: "paragraph",
          content: [
            { text: "Türkçe " },
            {
              text: "bağlantı",
              marks: [{ type: "bold" }, { type: "link", href: "https://example.com" }],
            },
          ],
        },
      ],
    });
    assert.deepEqual(editorDocumentToTiptapDocument(parsed.document), {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Türkçe " },
            {
              type: "text",
              text: "bağlantı",
              marks: [
                { type: "bold" },
                { type: "link", attrs: { href: "https://example.com" } },
              ],
            },
          ],
        },
      ],
    });
  });

  it("fails closed for oversized block counts", () => {
    const parsed = bodyToEditorDocument({
      blocks: Array.from({ length: 501 }, (_, index) => ({
        type: "paragraph",
        text: `P${index}`,
      })),
    });
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.equal(parsed.reason, "unsupported");
  });
});

describe("structured body dirty state", () => {
  const initial: BodyEditorDocument = {
    blocks: [{ type: "paragraph", text: "İlk paragraf", content: [{ text: "İlk paragraf" }] }],
  };

  it("starts clean", () => {
    assert.equal(bodyEditorDocumentsEqual(initial, cloneBodyEditorDocument(initial)), true);
  });

  it("marks paragraph text edits dirty", () => {
    assert.equal(
      bodyEditorDocumentsEqual(initial, {
        blocks: [
          {
            type: "paragraph",
            text: "Değişen paragraf",
            content: [{ text: "Değişen paragraf" }],
          },
        ],
      }),
      false,
    );
  });

  it("returns clean after exact semantic revert", () => {
    const edited: BodyEditorDocument = {
      blocks: [
        {
          type: "paragraph",
          text: "Değişen paragraf",
          content: [{ text: "Değişen paragraf" }],
        },
      ],
    };
    edited.blocks[0]!.text = "İlk paragraf";
    edited.blocks[0]!.content = [{ text: "İlk paragraf" }];
    assert.equal(bodyEditorDocumentsEqual(initial, edited), true);
  });

  it("marks heading changes dirty", () => {
    assert.equal(
      bodyEditorDocumentsEqual(
        { blocks: [{ type: "heading", level: 2, text: "A", content: [{ text: "A" }] }] },
        { blocks: [{ type: "heading", level: 3, text: "A", content: [{ text: "A" }] }] },
      ),
      false,
    );
  });

  it("marks bold toggles dirty and exact reverts clean", () => {
    const bold: BodyEditorDocument = {
      blocks: [
        {
          type: "paragraph",
          text: "İlk paragraf",
          content: [{ text: "İlk paragraf", marks: [{ type: "bold" }] }],
        },
      ],
    };
    assert.equal(bodyEditorDocumentsEqual(initial, bold), false);
    bold.blocks[0]!.content = [{ text: "İlk paragraf" }];
    assert.equal(bodyEditorDocumentsEqual(initial, bold), true);
  });

  it("marks italic changes dirty", () => {
    assert.equal(
      bodyEditorDocumentsEqual(initial, {
        blocks: [
          {
            type: "paragraph",
            text: "İlk paragraf",
            content: [{ text: "İlk paragraf", marks: [{ type: "italic" }] }],
          },
        ],
      }),
      false,
    );
  });

  it("marks link added, removed, and href-only changes dirty", () => {
    const linkedA: BodyEditorDocument = {
      blocks: [
        {
          type: "paragraph",
          text: "İlk paragraf",
          content: [
            {
              text: "İlk paragraf",
              marks: [{ type: "link", href: "https://example.com/a" }],
            },
          ],
        },
      ],
    };
    const linkedB: BodyEditorDocument = {
      blocks: [
        {
          type: "paragraph",
          text: "İlk paragraf",
          content: [
            {
              text: "İlk paragraf",
              marks: [{ type: "link", href: "https://example.com/b" }],
            },
          ],
        },
      ],
    };

    assert.equal(bodyEditorDocumentsEqual(initial, linkedA), false);
    assert.equal(bodyEditorDocumentsEqual(linkedA, initial), false);
    assert.equal(bodyEditorDocumentsEqual(linkedA, linkedB), false);
  });

  it("does not treat focus or selection-only state as body data", () => {
    const focusedClone = cloneBodyEditorDocument(initial);
    assert.equal(bodyEditorDocumentsEqual(initial, focusedClone), true);
  });
});
