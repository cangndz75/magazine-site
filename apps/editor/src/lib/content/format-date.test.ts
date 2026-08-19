import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDate, formatDateTime } from "./format-date";

describe("editorial date formatting", () => {
  it("formats absolute timestamps in Europe/Istanbul without the host timezone", () => {
    assert.equal(formatDate("2026-08-18T12:30:00.000Z"), "18 Ağu 2026");
    assert.equal(
      formatDateTime("2026-08-18T12:30:00.000Z").startsWith("18 Ağu 2026 15:30"),
      true,
    );
  });
});
