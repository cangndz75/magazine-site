import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EDITORIAL_TIMEZONE,
  editorialWallTimeToUtcIso,
  formatEditorialDateTime,
  isUtcIsoInTheFuture,
  utcIsoToEditorialInputs,
} from "./editorial-timezone";

describe("editorial timezone", () => {
  it("converts Istanbul wall time to a UTC instant without using the browser zone", () => {
    assert.equal(EDITORIAL_TIMEZONE, "Europe/Istanbul");
    const iso = editorialWallTimeToUtcIso("2026-08-18", "15:30");
    assert.equal(iso, "2026-08-18T12:30:00.000Z");
  });

  it("round-trips a UTC instant back to Istanbul date and time inputs", () => {
    const inputs = utcIsoToEditorialInputs("2026-08-18T12:30:00.000Z");
    assert.deepEqual(inputs, { date: "2026-08-18", time: "15:30" });
  });

  it("rejects invalid wall time and past instants", () => {
    assert.equal(editorialWallTimeToUtcIso("2026-13-40", "15:30"), null);
    assert.equal(editorialWallTimeToUtcIso("2026-08-18", "25:01"), null);
    assert.equal(
      isUtcIsoInTheFuture("2026-01-01T00:00:00.000Z", new Date("2026-08-17T00:00:00.000Z")),
      false,
    );
    assert.equal(
      isUtcIsoInTheFuture("2026-08-18T12:30:00.000Z", new Date("2026-08-17T00:00:00.000Z")),
      true,
    );
  });

  it("labels scheduled times with the editorial timezone", () => {
    const labeled = formatEditorialDateTime("2026-08-18T12:30:00.000Z");
    assert.equal(labeled.includes("Türkiye saati"), true);
    assert.equal(labeled.includes("Europe/Istanbul"), true);
    assert.equal(labeled.startsWith("18 Ağu 2026 15:30"), true);
  });
});
