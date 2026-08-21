function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(extractText).join("");
  }

  if (!isRecord(value)) {
    return "";
  }

  if (typeof value.text === "string") {
    return value.text;
  }

  if (value.content !== undefined) {
    return extractText(value.content);
  }

  return "";
}

function walkBlocks(body: unknown): unknown[] {
  if (Array.isArray(body)) {
    return body;
  }

  if (isRecord(body) && Array.isArray(body.blocks)) {
    return body.blocks;
  }

  if (isRecord(body) && Array.isArray(body.content)) {
    return body.content;
  }

  return [];
}

export type SeoBodyInspection = {
  present: boolean;
  textLength: number;
  headingCount: number;
  inspectable: boolean;
};

/**
 * Safe, read-only inspection of structured article body JSON.
 * Does not execute HTML and does not invent a new document schema.
 */
export function inspectStructuredArticleBody(body: unknown): SeoBodyInspection {
  if (body === null || body === undefined) {
    return {
      present: false,
      textLength: 0,
      headingCount: 0,
      inspectable: false,
    };
  }

  if (typeof body !== "object") {
    return {
      present: false,
      textLength: 0,
      headingCount: 0,
      inspectable: false,
    };
  }

  const blocks = walkBlocks(body);
  let textLength = 0;
  let headingCount = 0;

  for (const block of blocks) {
    if (!isRecord(block)) {
      continue;
    }
    const text = extractText(block).trim();
    textLength += text.length;
    if (block.type === "heading" && text.length > 0) {
      headingCount += 1;
    }
  }

  if (blocks.length === 0) {
    const fallback = extractText(body).trim();
    textLength = fallback.length;
  }

  return {
    present: textLength > 0,
    textLength,
    headingCount,
    inspectable: true,
  };
}
