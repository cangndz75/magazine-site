import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const journalPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../drizzle/meta/_journal.json",
);

describe("drizzle entity migration journal", () => {
  it("keeps 0022 entity foundation ahead of 0023 cache events", () => {
    const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
      entries: { idx: number; tag: string }[];
    };
    const tags = journal.entries.map((entry) => entry.tag);
    const entityIdx = tags.indexOf("0022_entity-platform-foundation");
    const cacheIdx = tags.indexOf("0023_public-cache-outbox-entity-events");
    assert.notEqual(entityIdx, -1);
    assert.notEqual(cacheIdx, -1);
    assert.equal(entityIdx < cacheIdx, true);
    assert.equal(journal.entries[entityIdx]?.idx, 21);
    assert.equal(journal.entries[cacheIdx]?.idx, 22);
  });
});
