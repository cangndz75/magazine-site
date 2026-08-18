import type { ReactNode } from "react";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeHttpUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type PublicInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
};

type PublicBlock =
  | { type: "paragraph"; inlines: PublicInline[] }
  | { type: "heading"; level: 2 | 3; inlines: PublicInline[] };

function readInlines(block: Record<string, unknown>): PublicInline[] {
  if (Array.isArray(block.content)) {
    const inlines: PublicInline[] = [];
    for (const node of block.content) {
      if (!isRecord(node) || typeof node.text !== "string") {
        continue;
      }
      const marks = Array.isArray(node.marks) ? node.marks : [];
      let bold = false;
      let italic = false;
      let href: string | undefined;
      for (const mark of marks) {
        if (!isRecord(mark) || typeof mark.type !== "string") {
          continue;
        }
        if (mark.type === "bold") {
          bold = true;
        }
        if (mark.type === "italic") {
          italic = true;
        }
        if (
          mark.type === "link" &&
          typeof mark.href === "string" &&
          isSafeHttpUrl(mark.href)
        ) {
          href = mark.href;
        }
      }
      inlines.push({ text: node.text, bold, italic, href });
    }
    if (inlines.length > 0) {
      return inlines;
    }
  }

  if (typeof block.text === "string" && block.text.length > 0) {
    return [{ text: block.text }];
  }

  return [];
}

export function publicArticleBlocks(body: unknown): PublicBlock[] {
  if (!isRecord(body) || !Array.isArray(body.blocks)) {
    return [];
  }

  const blocks: PublicBlock[] = [];
  for (const raw of body.blocks) {
    if (!isRecord(raw) || typeof raw.type !== "string") {
      continue;
    }
    const inlines = readInlines(raw);
    if (inlines.length === 0) {
      continue;
    }
    if (raw.type === "paragraph") {
      blocks.push({ type: "paragraph", inlines });
      continue;
    }
    if (raw.type === "heading") {
      const level = raw.level === 3 ? 3 : 2;
      blocks.push({ type: "heading", level, inlines });
    }
  }
  return blocks;
}

function InlineText({ inline }: { inline: PublicInline }) {
  let node: ReactNode = inline.text;
  if (inline.bold) {
    node = <strong>{node}</strong>;
  }
  if (inline.italic) {
    node = <em>{node}</em>;
  }
  if (inline.href) {
    node = (
      <a href={inline.href} rel="noopener noreferrer">
        {node}
      </a>
    );
  }
  return node;
}

export function PublicArticleBody({ body }: { body: unknown }) {
  const blocks = publicArticleBlocks(body);
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div>
      {blocks.map((block, index) => {
        const children = block.inlines.map((inline, inlineIndex) => (
          <InlineText key={inlineIndex} inline={inline} />
        ));
        if (block.type === "heading" && block.level === 3) {
          return (
            <h3 key={index} className="mt-6 text-lg font-semibold text-zinc-900">
              {children}
            </h3>
          );
        }
        if (block.type === "heading") {
          return (
            <h2 key={index} className="mt-8 text-xl font-semibold text-zinc-900">
              {children}
            </h2>
          );
        }
        return (
          <p key={index} className="mt-4 text-base leading-7 text-zinc-800">
            {children}
          </p>
        );
      })}
    </div>
  );
}
