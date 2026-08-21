import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";

const root = path.join(import.meta.dirname, "..", "..", "..");

describe("entity route contracts", () => {
  it("requires entity write capability on manager routes", () => {
    const files = [
      "src/app/api/entities/route.ts",
      "src/app/api/entities/[entityId]/route.ts",
      "src/app/api/entities/[entityId]/activate/route.ts",
    ];
    for (const file of files) {
      const source = readFileSync(path.join(root, file), "utf8");
      assert.match(source, /withEntityManager(Read|Write)/);
      assert.match(source, /assertSafeEntityHttpPayload/);
    }
  });

  it("does not expose storageKey in entity serializers", () => {
    const source = readFileSync(
      path.join(root, "src/lib/entity/serialize.ts"),
      "utf8",
    );
    assert.match(source, /storageKey/);
    assert.doesNotMatch(source, /storageKey:/);
  });
});

describe("entity workspace authorization", () => {
  it("gates entity pages with requireEntityWrite", () => {
    const source = readFileSync(
      path.join(root, "src/app/(workspace)/entities/page.tsx"),
      "utf8",
    );
    assert.match(source, /requireEntityWrite/);
  });
});
