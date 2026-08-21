import { PUBLISHING_ERROR, type PublishingDecision } from "../publishing/errors";
import { lcsIndexPairs } from "./diff-lcs";
import { stableJson, tokenizeEditorialText } from "./diff-text";
import {
  DIFF_CHANGE_TYPE,
  DIFF_DETAIL_LIMIT,
  DIFF_INLINE_TYPE,
  DIFF_MAX_BLOCKS,
  DIFF_MAX_BLOCK_TEXT_CHARS,
  DIFF_MAX_INLINE_TOKENS,
  type ContentVersionBlockDiff,
  type ContentVersionBodyDiff,
  type ContentVersionInlineChange,
} from "./diff-types";

export type ParsedDiffBlock = {
  index: number;
  type: string;
  id: string | null;
  text: string;
  links: string[];
  signature: string;
};

const TEXT_BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "quote",
  "list",
  "callout",
]);

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

function extractLinks(value: unknown, acc: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      extractLinks(item, acc);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (typeof value.href === "string" && value.href.length > 0) {
    acc.push(value.href);
  }

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") {
      extractLinks(nested, acc);
    }
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function parseArticleBlocks(
  body: unknown,
): PublishingDecision<ParsedDiffBlock[]> {
  if (typeof body === "string" || typeof body === "number" || typeof body === "boolean") {
    return { ok: false, code: PUBLISHING_ERROR.CONTENT_BODY_CORRUPT };
  }

  if (body === null || body === undefined) {
    return { ok: false, code: PUBLISHING_ERROR.CONTENT_BODY_CORRUPT };
  }

  let rawBlocks: unknown;
  if (Array.isArray(body)) {
    rawBlocks = body;
  } else if (isRecord(body) && Array.isArray(body.blocks)) {
    rawBlocks = body.blocks;
  } else if (isRecord(body)) {
    rawBlocks = [body];
  } else {
    return { ok: false, code: PUBLISHING_ERROR.CONTENT_BODY_CORRUPT };
  }

  const blocks: ParsedDiffBlock[] = [];
  for (const [index, raw] of (rawBlocks as unknown[]).entries()) {
    if (!isRecord(raw)) {
      return { ok: false, code: PUBLISHING_ERROR.CONTENT_BODY_CORRUPT };
    }

    const type = typeof raw.type === "string" && raw.type.length > 0 ? raw.type : "unknown";
    const id = typeof raw.id === "string" && raw.id.length > 0 ? raw.id : null;
    const rest = { ...raw };
    delete rest.id;
    const links = uniqueSorted((() => {
      const acc: string[] = [];
      extractLinks(raw, acc);
      return acc;
    })());

    blocks.push({
      index,
      type,
      id,
      text: extractText(raw),
      links,
      signature: `${type}:${stableJson(rest)}`,
    });
  }

  return { ok: true, value: blocks };
}

function inlineDiff(
  beforeText: string,
  afterText: string,
): { changes?: ContentVersionInlineChange[]; limited: boolean } {
  if (beforeText === afterText) {
    return { limited: false };
  }

  if (
    beforeText.length > DIFF_MAX_BLOCK_TEXT_CHARS ||
    afterText.length > DIFF_MAX_BLOCK_TEXT_CHARS
  ) {
    return { limited: true };
  }

  const beforeTokens = tokenizeEditorialText(beforeText);
  const afterTokens = tokenizeEditorialText(afterText);
  if (
    beforeTokens.length > DIFF_MAX_INLINE_TOKENS ||
    afterTokens.length > DIFF_MAX_INLINE_TOKENS
  ) {
    return { limited: true };
  }

  const pairs = lcsIndexPairs(beforeTokens, afterTokens);
  const matchedLeft = new Set(pairs.map((pair) => pair.left));
  const matchedRight = new Set(pairs.map((pair) => pair.right));
  const changes: ContentVersionInlineChange[] = [];

  function push(type: ContentVersionInlineChange["type"], text: string): void {
    const last = changes[changes.length - 1];
    if (last && last.type === type) {
      last.text += text;
      return;
    }
    changes.push({ type, text });
  }

  let left = 0;
  let right = 0;
  for (const pair of pairs) {
    while (left < pair.left) {
      if (!matchedLeft.has(left)) {
        push(DIFF_INLINE_TYPE.REMOVED, beforeTokens[left]!);
      }
      left += 1;
    }
    while (right < pair.right) {
      if (!matchedRight.has(right)) {
        push(DIFF_INLINE_TYPE.ADDED, afterTokens[right]!);
      }
      right += 1;
    }
    push(DIFF_INLINE_TYPE.EQUAL, beforeTokens[pair.left]!);
    left += 1;
    right += 1;
  }
  while (left < beforeTokens.length) {
    push(DIFF_INLINE_TYPE.REMOVED, beforeTokens[left]!);
    left += 1;
  }
  while (right < afterTokens.length) {
    push(DIFF_INLINE_TYPE.ADDED, afterTokens[right]!);
    right += 1;
  }

  return { changes, limited: false };
}

function uniqueIds(blocks: ParsedDiffBlock[]): Map<string, number> | null {
  const map = new Map<string, number>();
  for (const block of blocks) {
    if (!block.id) {
      return null;
    }
    if (map.has(block.id)) {
      return null;
    }
    map.set(block.id, block.index);
  }
  return map;
}

function countBySignature(blocks: ParsedDiffBlock[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const block of blocks) {
    counts.set(block.signature, (counts.get(block.signature) ?? 0) + 1);
  }
  return counts;
}

function toBlockDiff(
  changeType: ContentVersionBlockDiff["changeType"],
  fromBlock: ParsedDiffBlock | null,
  toBlock: ParsedDiffBlock | null,
): ContentVersionBlockDiff {
  const beforeText = fromBlock?.text ?? null;
  const afterText = toBlock?.text ?? null;
  const blockType = toBlock?.type ?? fromBlock?.type ?? "unknown";
  const textBearing =
    TEXT_BLOCK_TYPES.has(blockType) ||
    Boolean(beforeText) ||
    Boolean(afterText);
  const row: ContentVersionBlockDiff = {
    changeType,
    blockType,
    fromIndex: fromBlock?.index ?? null,
    toIndex: toBlock?.index ?? null,
    beforeText,
    afterText,
  };

  const beforeLinks = fromBlock?.links ?? [];
  const afterLinks = toBlock?.links ?? [];
  if (beforeLinks.length > 0 || afterLinks.length > 0) {
    row.links = {
      before: beforeLinks,
      after: afterLinks,
      changed: stableJson(beforeLinks) !== stableJson(afterLinks),
    };
  }

  if (
    changeType === DIFF_CHANGE_TYPE.MODIFIED &&
    textBearing &&
    beforeText !== null &&
    afterText !== null
  ) {
    const inline = inlineDiff(beforeText, afterText);
    if (inline.limited) {
      row.inlineDetailLimited = true;
    } else if (inline.changes) {
      row.inlineChanges = inline.changes;
    }
  }

  return row;
}

function limitedBody(changed: boolean): ContentVersionBodyDiff {
  return {
    changed,
    detailLimited: true,
    blocks: changed
      ? [
          {
            changeType: DIFF_CHANGE_TYPE.MODIFIED,
            blockType: "document",
            fromIndex: null,
            toIndex: null,
            beforeText: null,
            afterText: null,
            inlineDetailLimited: true,
          },
        ]
      : [],
  };
}

export function diffArticleBodies(
  fromBody: unknown,
  toBody: unknown,
): PublishingDecision<ContentVersionBodyDiff> {
  const fromParsed = parseArticleBlocks(fromBody);
  if (!fromParsed.ok) {
    return fromParsed;
  }
  const toParsed = parseArticleBlocks(toBody);
  if (!toParsed.ok) {
    return toParsed;
  }

  const fromBlocks = fromParsed.value;
  const toBlocks = toParsed.value;

  if (
    fromBlocks.length > DIFF_MAX_BLOCKS ||
    toBlocks.length > DIFF_MAX_BLOCKS
  ) {
    return {
      ok: true,
      value: limitedBody(stableJson(fromBody) !== stableJson(toBody)),
    };
  }

  const fromIds = uniqueIds(fromBlocks);
  const toIds = uniqueIds(toBlocks);
  const changes: ContentVersionBlockDiff[] = [];

  if (fromIds && toIds) {
    const seenTo = new Set<number>();
    for (const fromBlock of fromBlocks) {
      const toIndex = toIds.get(fromBlock.id!);
      if (toIndex === undefined) {
        changes.push(toBlockDiff(DIFF_CHANGE_TYPE.REMOVED, fromBlock, null));
        continue;
      }
      seenTo.add(toIndex);
      const toBlock = toBlocks[toIndex]!;
      if (fromBlock.signature === toBlock.signature) {
        if (fromBlock.index !== toBlock.index) {
          changes.push(toBlockDiff(DIFF_CHANGE_TYPE.MOVED, fromBlock, toBlock));
        }
      } else {
        changes.push(toBlockDiff(DIFF_CHANGE_TYPE.MODIFIED, fromBlock, toBlock));
      }
    }
    for (const toBlock of toBlocks) {
      if (!seenTo.has(toBlock.index)) {
        changes.push(toBlockDiff(DIFF_CHANGE_TYPE.ADDED, null, toBlock));
      }
    }

    return {
      ok: true,
      value: {
        changed: changes.length > 0,
        detailLimited: false,
        blocks: changes,
      },
    };
  }

  const pairs = lcsIndexPairs(
    fromBlocks.map((block) => block.signature),
    toBlocks.map((block) => block.signature),
  );
  const matchedFrom = new Set(pairs.map((pair) => pair.left));
  const matchedTo = new Set(pairs.map((pair) => pair.right));
  const consumedFrom = new Set(matchedFrom);
  const consumedTo = new Set(matchedTo);

  const unmatchedFrom = fromBlocks.filter((block) => !consumedFrom.has(block.index));
  const unmatchedTo = toBlocks.filter((block) => !consumedTo.has(block.index));
  const fromSigCounts = countBySignature(unmatchedFrom);
  const toSigCounts = countBySignature(unmatchedTo);

  for (const fromBlock of unmatchedFrom) {
    if (
      fromSigCounts.get(fromBlock.signature) !== 1 ||
      toSigCounts.get(fromBlock.signature) !== 1
    ) {
      continue;
    }
    const toBlock = unmatchedTo.find(
      (block) =>
        !consumedTo.has(block.index) && block.signature === fromBlock.signature,
    );
    if (!toBlock) {
      continue;
    }
    changes.push(toBlockDiff(DIFF_CHANGE_TYPE.MOVED, fromBlock, toBlock));
    consumedFrom.add(fromBlock.index);
    consumedTo.add(toBlock.index);
  }

  const anchors = [
    { left: -1, right: -1 },
    ...pairs,
    { left: fromBlocks.length, right: toBlocks.length },
  ];

  for (let anchor = 0; anchor < anchors.length - 1; anchor += 1) {
    const fromHunk = fromBlocks.slice(anchors[anchor]!.left + 1, anchors[anchor + 1]!.left);
    const toHunk = toBlocks.slice(anchors[anchor]!.right + 1, anchors[anchor + 1]!.right);
    const remainingFrom = fromHunk.filter((block) => !consumedFrom.has(block.index));
    const remainingTo = toHunk.filter((block) => !consumedTo.has(block.index));
    const usedTo = new Set<number>();

    for (const fromBlock of remainingFrom) {
      const toBlock = remainingTo.find(
        (block) => !usedTo.has(block.index) && block.type === fromBlock.type,
      );
      if (toBlock) {
        usedTo.add(toBlock.index);
        changes.push(toBlockDiff(DIFF_CHANGE_TYPE.MODIFIED, fromBlock, toBlock));
        continue;
      }
      changes.push(toBlockDiff(DIFF_CHANGE_TYPE.REMOVED, fromBlock, null));
    }

    for (const toBlock of remainingTo) {
      if (usedTo.has(toBlock.index)) {
        continue;
      }
      changes.push(toBlockDiff(DIFF_CHANGE_TYPE.ADDED, null, toBlock));
    }
  }

  return {
    ok: true,
    value: {
      changed: changes.length > 0,
      detailLimited: false,
      blocks: changes,
    },
  };
}

export { DIFF_DETAIL_LIMIT };
