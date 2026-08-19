export type BodyEditorBlockType = "paragraph" | "heading";
export type BodyEditorHeadingLevel = 2 | 3;

export type BodyEditorMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; href: string };

export type BodyEditorInline = {
  text: string;
  marks?: BodyEditorMark[];
};

export type BodyEditorBlock = {
  id?: string;
  type: BodyEditorBlockType;
  text: string;
  content: BodyEditorInline[];
  level?: BodyEditorHeadingLevel;
  placeholder?: boolean;
};

export type BodyEditorDocument = {
  blocks: BodyEditorBlock[];
};

export type BodyEditorParseResult =
  | { ok: true; document: BodyEditorDocument; canonicalBody: CanonicalArticleBody }
  | { ok: false; reason: "malformed" | "unsupported"; message: string };

type BodyEditorParseFailure = Extract<BodyEditorParseResult, { ok: false }>;

export type CanonicalArticleBody = {
  blocks: CanonicalArticleBlock[];
};

export type CanonicalArticleInline = {
  text: string;
  marks?: BodyEditorMark[];
};

export type CanonicalArticleBlock =
  | {
      id?: string;
      type: "paragraph";
      text: string;
      content?: never;
    }
  | {
      id?: string;
      type: "paragraph";
      content: CanonicalArticleInline[];
      text?: never;
    }
  | {
      id?: string;
      type: "heading";
      text: string;
      level?: BodyEditorHeadingLevel;
      content?: never;
    }
  | {
      id?: string;
      type: "heading";
      content: CanonicalArticleInline[];
      level?: BodyEditorHeadingLevel;
      text?: never;
    };

const SUPPORTED_BLOCK_TYPES = new Set(["paragraph", "heading"]);
const ALLOWED_PARAGRAPH_KEYS = new Set(["id", "type", "text", "content"]);
const ALLOWED_HEADING_KEYS = new Set(["id", "type", "text", "content", "level"]);
const ALLOWED_INLINE_KEYS = new Set(["text", "marks"]);
const ALLOWED_MARK_KEYS = new Set(["type", "href"]);
const BODY_EDITOR_MAX_BLOCKS = 500;
const BODY_EDITOR_SUPPORTED_UNSUPPORTED_MESSAGE =
  "Bu gövdede bu editör geçişinin henüz düzenleyemediği bloklar var.";

type TiptapTextNode = {
  type: "text";
  text: string;
  marks?: TiptapMark[];
};

type TiptapMark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "link"; attrs: { href: string } };

type TiptapBlockNode = {
  type: "paragraph" | "heading";
  attrs?: { level?: BodyEditorHeadingLevel };
  content?: TiptapTextNode[];
};

export type TiptapBodyDocument = {
  type: "doc";
  content: TiptapBlockNode[];
};

export function bodyToEditorDocument(body: unknown): BodyEditorParseResult {
  const rawBlocks = rawBodyBlocks(body);
  if (!rawBlocks) {
    return {
      ok: false,
      reason: "malformed",
      message: "Gövde yapısı bu editörde açılamıyor.",
    };
  }

  if (rawBlocks.length > BODY_EDITOR_MAX_BLOCKS) {
    return {
      ok: false,
      reason: "unsupported",
      message:
        "Bu gövde bu editör geçişi için güvenli düzenleme sınırını aşıyor.",
    };
  }

  const blocks: BodyEditorBlock[] = [];
  for (const raw of rawBlocks) {
    if (!isRecord(raw)) {
      return {
        ok: false,
        reason: "malformed",
        message: "Gövde bloklarından biri geçerli değil.",
      };
    }

    const type = raw.type;
    if (typeof type !== "string" || !SUPPORTED_BLOCK_TYPES.has(type)) {
      return {
        ok: false,
        reason: "unsupported",
        message: BODY_EDITOR_SUPPORTED_UNSUPPORTED_MESSAGE,
      };
    }

    const inline = parseBlockInlineContent(raw);
    if (!inline.ok) {
      return {
        ok: false,
        reason: inline.reason,
        message: inline.message,
      };
    }

    if (type === "paragraph") {
      if (!onlyAllowedKeys(raw, ALLOWED_PARAGRAPH_KEYS)) {
        return unsupportedRichContent();
      }
      blocks.push({
        ...(typeof raw.id === "string" && raw.id ? { id: raw.id } : {}),
        type: "paragraph",
        text: inline.text,
        content: inline.content,
      });
      continue;
    }

    if (!onlyAllowedKeys(raw, ALLOWED_HEADING_KEYS)) {
      return unsupportedRichContent();
    }

    const level = raw.level === undefined ? undefined : raw.level;
    if (level !== undefined && level !== 2 && level !== 3) {
      return {
        ok: false,
        reason: "unsupported",
        message: "Bu gövdede desteklenmeyen başlık seviyesi var.",
      };
    }

    blocks.push({
      ...(typeof raw.id === "string" && raw.id ? { id: raw.id } : {}),
      type: "heading",
      text: inline.text,
      content: inline.content,
      ...(level ? { level } : {}),
    });
  }

  const document: BodyEditorDocument =
    blocks.length > 0
      ? { blocks }
      : {
          blocks: [
            {
              type: "paragraph",
              text: "",
              content: [],
              placeholder: true,
            },
          ],
        };

  return {
    ok: true,
    document,
    canonicalBody: editorDocumentToBody(document),
  };
}

export function editorDocumentToBody(
  document: BodyEditorDocument,
): CanonicalArticleBody {
  const blocks = document.blocks.flatMap((block): CanonicalArticleBlock[] => {
    if (block.placeholder && block.text.trim().length === 0) {
      return [];
    }

    const content = normalizeInlineContent(block.content);
    const text = inlineText(content);
    if (block.type === "heading") {
      const base = {
        ...(block.id ? { id: block.id } : {}),
        type: "heading" as const,
        ...(block.level ? { level: block.level } : {}),
      };
      return [hasMarks(content) ? { ...base, content } : { ...base, text }];
    }

    const base = {
      ...(block.id ? { id: block.id } : {}),
      type: "paragraph" as const,
    };
    return [hasMarks(content) ? { ...base, content } : { ...base, text }];
  });

  return { blocks };
}

export function bodyEditorDocumentsEqual(
  left: BodyEditorDocument,
  right: BodyEditorDocument,
): boolean {
  return stableStringify(editorDocumentToBody(left)) ===
    stableStringify(editorDocumentToBody(right));
}

export function cloneBodyEditorDocument(
  document: BodyEditorDocument,
): BodyEditorDocument {
  return {
    blocks: document.blocks.map((block) => ({
      ...block,
      content: cloneInlineContent(block.content),
    })),
  };
}

export function editorDocumentToTiptapDocument(
  document: BodyEditorDocument,
): TiptapBodyDocument {
  return {
    type: "doc",
    content: document.blocks.map((block): TiptapBlockNode => {
      const content = normalizeInlineContent(block.content);
      return {
        type: block.type,
        ...(block.type === "heading"
          ? { attrs: { level: block.level ?? 2 } }
          : {}),
        ...(content.length > 0
          ? { content: content.map(canonicalInlineToTiptapTextNode) }
          : {}),
      };
    }),
  };
}

export function tiptapDocumentToEditorDocument(
  value: unknown,
): BodyEditorParseResult {
  if (!isRecord(value) || value.type !== "doc") {
    return {
      ok: false,
      reason: "malformed",
      message: "Editör gövdesi geçerli bir belge üretmedi.",
    };
  }

  if (value.content !== undefined && !Array.isArray(value.content)) {
    return {
      ok: false,
      reason: "malformed",
      message: "Editör gövdesi geçerli bloklar üretmedi.",
    };
  }

  const blocks: BodyEditorBlock[] = [];
  for (const node of value.content ?? []) {
    if (!isRecord(node) || typeof node.type !== "string") {
      return unsupportedTiptapDocument();
    }

    if (node.type !== "paragraph" && node.type !== "heading") {
      return unsupportedTiptapDocument();
    }

    const attrs = isRecord(node.attrs) ? node.attrs : {};
    const level =
      node.type === "heading" && attrs.level !== undefined
        ? attrs.level
        : undefined;
    if (level !== undefined && level !== 2 && level !== 3) {
      return unsupportedTiptapDocument();
    }

    const content = tiptapNodeContentToInline(node.content);
    if (!content.ok) {
      return content;
    }

    blocks.push({
      type: node.type,
      text: inlineText(content.content),
      content: content.content,
      ...(node.type === "heading" ? { level: (level ?? 2) as BodyEditorHeadingLevel } : {}),
    });
  }

  const document: BodyEditorDocument =
    blocks.length > 0
      ? { blocks }
      : { blocks: [{ type: "paragraph", text: "", content: [], placeholder: true }] };

  return {
    ok: true,
    document,
    canonicalBody: editorDocumentToBody(document),
  };
}

export function isSafeHttpUrl(href: string): boolean {
  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function parseBlockInlineContent(
  raw: Record<string, unknown>,
):
  | { ok: true; text: string; content: BodyEditorInline[] }
  | { ok: false; reason: "malformed" | "unsupported"; message: string } {
  const hasText = Object.hasOwn(raw, "text");
  const hasContent = Object.hasOwn(raw, "content");

  if (hasText && hasContent) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Bu gövde çakışan metin temsilleri içeriyor.",
    };
  }

  if (hasText) {
    if (typeof raw.text !== "string") {
      return {
        ok: false,
        reason: "unsupported",
        message: "Bu gövde metni desteklenmeyen bir biçimde saklanmış.",
      };
    }
    return {
      ok: true,
      text: raw.text,
      content: raw.text.length > 0 ? [{ text: raw.text }] : [],
    };
  }

  if (!hasContent || !Array.isArray(raw.content)) {
    return {
      ok: false,
      reason: "unsupported",
      message: "Bu gövdede desteklenmeyen metin yapısı var.",
    };
  }

  const parsed = parseInlineContent(raw.content);
  if (!parsed.ok) {
    return parsed;
  }

  return {
    ok: true,
    text: inlineText(parsed.content),
    content: parsed.content,
  };
}

function parseInlineContent(
  nodes: unknown[],
):
  | { ok: true; content: BodyEditorInline[] }
  | { ok: false; reason: "malformed" | "unsupported"; message: string } {
  const content: BodyEditorInline[] = [];
  for (const node of nodes) {
    if (!isRecord(node) || !onlyAllowedKeys(node, ALLOWED_INLINE_KEYS)) {
      return malformedRichContent();
    }
    if (typeof node.text !== "string") {
      return malformedRichContent();
    }

    const marks = node.marks === undefined ? undefined : parseMarks(node.marks);
    if (marks && !marks.ok) {
      return marks;
    }
    content.push({
      text: node.text,
      ...(marks?.marks && marks.marks.length > 0 ? { marks: marks.marks } : {}),
    });
  }

  return { ok: true, content: normalizeInlineContent(content) };
}

function parseMarks(
  value: unknown,
):
  | { ok: true; marks: BodyEditorMark[] }
  | { ok: false; reason: "malformed" | "unsupported"; message: string } {
  if (!Array.isArray(value)) {
    return malformedRichContent();
  }

  const marks: BodyEditorMark[] = [];
  for (const mark of value) {
    if (!isRecord(mark) || !onlyAllowedKeys(mark, ALLOWED_MARK_KEYS)) {
      return malformedRichContent();
    }
    if (mark.type === "bold" || mark.type === "italic") {
      marks.push({ type: mark.type });
      continue;
    }
    if (mark.type === "link" && typeof mark.href === "string" && isSafeHttpUrl(mark.href)) {
      marks.push({ type: "link", href: mark.href });
      continue;
    }
    return {
      ok: false,
      reason: "unsupported",
      message: "Bu gövdede desteklenmeyen veya güvenli olmayan bağlantı var.",
    };
  }

  return { ok: true, marks: normalizeMarks(marks) };
}

function tiptapNodeContentToInline(
  value: unknown,
):
  | { ok: true; content: BodyEditorInline[] }
  | { ok: false; reason: "malformed" | "unsupported"; message: string } {
  if (value === undefined) {
    return { ok: true, content: [] };
  }
  if (!Array.isArray(value)) {
    return unsupportedTiptapDocument();
  }

  const content: BodyEditorInline[] = [];
  for (const node of value) {
    if (!isRecord(node) || node.type !== "text" || typeof node.text !== "string") {
      return unsupportedTiptapDocument();
    }
    const marks = node.marks === undefined ? undefined : tiptapMarksToCanonical(node.marks);
    if (marks && !marks.ok) {
      return marks;
    }
    content.push({
      text: node.text,
      ...(marks?.marks && marks.marks.length > 0 ? { marks: marks.marks } : {}),
    });
  }

  return { ok: true, content: normalizeInlineContent(content) };
}

function tiptapMarksToCanonical(
  value: unknown,
):
  | { ok: true; marks: BodyEditorMark[] }
  | { ok: false; reason: "malformed" | "unsupported"; message: string } {
  if (!Array.isArray(value)) {
    return unsupportedTiptapDocument();
  }
  const marks: BodyEditorMark[] = [];
  for (const mark of value) {
    if (!isRecord(mark)) {
      return unsupportedTiptapDocument();
    }
    if (mark.type === "bold" || mark.type === "italic") {
      marks.push({ type: mark.type });
      continue;
    }
    if (mark.type === "link" && isRecord(mark.attrs) && typeof mark.attrs.href === "string") {
      if (!isSafeHttpUrl(mark.attrs.href)) {
        return {
          ok: false,
          reason: "unsupported",
          message: "Editör güvenli olmayan bir bağlantı üretti.",
        };
      }
      marks.push({ type: "link", href: mark.attrs.href });
      continue;
    }
    return unsupportedTiptapDocument();
  }
  return { ok: true, marks: normalizeMarks(marks) };
}

function canonicalInlineToTiptapTextNode(inline: BodyEditorInline): TiptapTextNode {
  return {
    type: "text",
    text: inline.text,
    ...(inline.marks && inline.marks.length > 0
      ? { marks: inline.marks.map(canonicalMarkToTiptapMark) }
      : {}),
  };
}

function canonicalMarkToTiptapMark(mark: BodyEditorMark): TiptapMark {
  if (mark.type === "link") {
    return { type: "link", attrs: { href: mark.href } };
  }
  return { type: mark.type };
}

function normalizeInlineContent(content: BodyEditorInline[]): BodyEditorInline[] {
  const normalized: BodyEditorInline[] = [];
  for (const inline of content) {
    if (inline.text.length === 0) {
      continue;
    }
    const marks = normalizeMarks(inline.marks ?? []);
    const next: BodyEditorInline = {
      text: inline.text,
      ...(marks.length > 0 ? { marks } : {}),
    };
    const previous = normalized[normalized.length - 1];
    if (previous && stableStringify(previous.marks ?? []) === stableStringify(next.marks ?? [])) {
      previous.text += next.text;
      continue;
    }
    normalized.push(next);
  }
  return normalized;
}

function normalizeMarks(marks: BodyEditorMark[]): BodyEditorMark[] {
  const byKey = new Map<string, BodyEditorMark>();
  for (const mark of marks) {
    const key = mark.type === "link" ? `link:${mark.href}` : mark.type;
    byKey.set(key, mark);
  }
  return [...byKey.values()].sort((left, right) => markRank(left) - markRank(right));
}

function markRank(mark: BodyEditorMark): number {
  if (mark.type === "bold") return 1;
  if (mark.type === "italic") return 2;
  return 3;
}

function inlineText(content: BodyEditorInline[]): string {
  return content.map((inline) => inline.text).join("");
}

function hasMarks(content: BodyEditorInline[]): boolean {
  return content.some((inline) => inline.marks && inline.marks.length > 0);
}

function cloneInlineContent(content: BodyEditorInline[]): BodyEditorInline[] {
  return content.map((inline) => ({
    text: inline.text,
    ...(inline.marks ? { marks: inline.marks.map((mark) => ({ ...mark })) } : {}),
  }));
}

function rawBodyBlocks(body: unknown): unknown[] | null {
  if (Array.isArray(body)) {
    return body;
  }
  if (isRecord(body) && Array.isArray(body.blocks)) {
    return body.blocks;
  }
  if (isRecord(body)) {
    return [body];
  }
  return null;
}

function unsupportedRichContent(): BodyEditorParseFailure {
  return {
    ok: false,
    reason: "unsupported",
    message:
      "Bu gövde bu editörün kayıpsız düzenleyemeyeceği gelişmiş içerik içeriyor.",
  };
}

function malformedRichContent(): BodyEditorParseFailure {
  return {
    ok: false,
    reason: "malformed",
    message: "Bu gövde geçersiz zengin metin yapısı içeriyor.",
  };
}

function unsupportedTiptapDocument(): BodyEditorParseFailure {
  return {
    ok: false,
    reason: "unsupported",
    message: "Editör desteklenmeyen bir gövde yapısı üretti.",
  };
}

function onlyAllowedKeys(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): boolean {
  return Object.keys(record).every((key) => allowed.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
