import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDate, formatDateTime, formatRelativeDate } from "./format-date";

describe("editorial date formatting", () => {
  it("formats absolute timestamps in Europe/Istanbul without the host timezone", () => {
    assert.equal(formatDate("2026-08-18T12:30:00.000Z"), "18 Ağu 2026");
    assert.equal(
      formatDateTime("2026-08-18T12:30:00.000Z").startsWith("18 Ağu 2026 15:30"),
      true,
    );
  });

  it("formatRelativeDate changes as the clock advances", () => {
    const recent = new Date(Date.now() - 30 * 60_000).toISOString();
    const older = new Date(Date.now() - 90 * 60_000).toISOString();

    assert.notEqual(formatRelativeDate(recent), formatRelativeDate(older));
    assert.match(formatRelativeDate(recent), /dk önce|sa önce/);
    assert.match(formatRelativeDate(older), /dk önce|sa önce/);
  });

  it("RelativeTime SSR pattern uses stable absolute timestamps until mount", () => {
    const iso = "2026-08-21T18:00:00.000Z";
    const ssrLabel = formatDateTime(iso);
    const now = new Date("2026-08-21T18:05:00.000Z");
    const originalNow = Date.now;

    Date.now = () => now.getTime();
    const relativeLabel = formatRelativeDate(iso);
    Date.now = originalNow;

    assert.notEqual(relativeLabel, ssrLabel);
    assert.equal(ssrLabel, formatDateTime(iso));
  });
});
