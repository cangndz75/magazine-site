import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatHomepageLivePublishedLabel } from "./builder-utils";

describe("formatHomepageLivePublishedLabel", () => {
  it("returns null when publishedAt is missing", () => {
    assert.equal(formatHomepageLivePublishedLabel(null), null);
    assert.equal(formatHomepageLivePublishedLabel(undefined), null);
  });

  it("formats authoritative published timestamps with editorial timezone", () => {
    const label = formatHomepageLivePublishedLabel("2026-08-18T12:30:00.000Z");
    assert.equal(label?.includes("Türkiye saati"), true);
    assert.equal(label?.includes("Europe/Istanbul"), true);
  });
});
