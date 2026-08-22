import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CONTENT_KIND } from "@magazine/domain";
import {
  calendarMonthDelta,
  parseCalendarPageSearchParams,
} from "./page-params";

const UUID = "11111111-1111-4111-8111-111111111111";

describe("calendar page params", () => {
  it("parses month into bounded UTC range", () => {
    const filters = parseCalendarPageSearchParams(
      { month: "2026-09" },
      new Date("2026-08-22T12:00:00.000Z"),
    );

    assert.equal(filters.month, "2026-09");
    assert.equal(filters.start.toISOString(), "2026-08-31T21:00:00.000Z");
    assert.equal(filters.end.toISOString(), "2026-09-30T21:00:00.000Z");
  });

  it("keeps only safe filter values", () => {
    const filters = parseCalendarPageSearchParams({
      month: "not-a-month",
      categoryId: UUID,
      authorId: "bad",
      contentKind: CONTENT_KIND.GALLERY,
    });

    assert.equal(filters.categoryId, UUID);
    assert.equal(filters.authorId, undefined);
    assert.equal(filters.contentKind, CONTENT_KIND.GALLERY);
  });

  it("moves across year boundaries", () => {
    assert.equal(calendarMonthDelta("2026-01", -1), "2025-12");
    assert.equal(calendarMonthDelta("2026-12", 1), "2027-01");
  });
});
