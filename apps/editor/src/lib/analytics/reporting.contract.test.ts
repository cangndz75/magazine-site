import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ANALYTICS_REPORTING_ERROR,
  ANALYTICS_REPORTING_METRIC,
  CAPABILITY,
  hasCapability,
  STAFF_ROLE,
} from "@magazine/domain";
import { parseAnalyticsReportQuery } from "./query";
import { assertSafeAnalyticsDto } from "./serialize";
import { EDITOR_API_ERROR, EditorHttpError } from "@/lib/content/http";

const apiRoot = path.join(
  fileURLToPath(new URL("../../app/api/analytics", import.meta.url)),
);

function read(file: string): string {
  return readFileSync(path.join(apiRoot, file), "utf8");
}

describe("analytics reporting query contract", () => {
  it("requires ANALYTICS_READ on every analytics report route", () => {
    for (const file of [
      "overview/route.ts",
      "timeseries/route.ts",
      "content/route.ts",
      "sources/route.ts",
      "categories/route.ts",
      "authors/route.ts",
      "homepage/route.ts",
    ]) {
      const source = read(file);
      assert.equal(source.includes("CAPABILITY.ANALYTICS_READ"), true, file);
      assert.equal(source.includes("withEditorRead"), true, file);
      assert.equal(source.includes("assertSafeAnalyticsDto"), true, file);
    }
  });

  it("does not give ANALYTICS_READ to authors", () => {
    assert.equal(hasCapability([STAFF_ROLE.AUTHOR], CAPABILITY.ANALYTICS_READ), false);
    assert.equal(hasCapability([STAFF_ROLE.EDITOR], CAPABILITY.ANALYTICS_READ), true);
    assert.equal(
      hasCapability([STAFF_ROLE.SUPER_ADMIN], CAPABILITY.ANALYTICS_READ),
      true,
    );
  });

  it("rejects invalid metric, granularity, and missing dates", () => {
    try {
      parseAnalyticsReportQuery(new URL("https://editor.example/api/analytics/overview"));
      assert.fail("expected throw");
    } catch (error) {
      assert.equal(error instanceof EditorHttpError, true);
      if (error instanceof EditorHttpError) {
        assert.equal(error.status, 400);
        assert.equal(error.code, ANALYTICS_REPORTING_ERROR.INVALID_RANGE);
      }
    }

    try {
      parseAnalyticsReportQuery(
        new URL(
          "https://editor.example/api/analytics/timeseries?from=2026-08-01&to=2026-08-07&granularity=MINUTE",
        ),
      );
      assert.fail("expected throw");
    } catch (error) {
      assert.equal(error instanceof EditorHttpError, true);
      if (error instanceof EditorHttpError) {
        assert.equal(error.code, ANALYTICS_REPORTING_ERROR.INVALID_GRANULARITY);
      }
    }

    try {
      parseAnalyticsReportQuery(
        new URL(
          "https://editor.example/api/analytics/content?from=2026-08-01&to=2026-08-07&metric=UNIQUE_VISITORS",
        ),
      );
      assert.fail("expected throw");
    } catch (error) {
      assert.equal(error instanceof EditorHttpError, true);
      if (error instanceof EditorHttpError) {
        assert.equal(error.code, ANALYTICS_REPORTING_ERROR.INVALID_METRIC);
      }
    }

    const parsed = parseAnalyticsReportQuery(
      new URL(
        `https://editor.example/api/analytics/content?from=2026-08-01&to=2026-08-07&metric=${ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS}&limit=10`,
      ),
    );
    assert.equal(parsed.limit, 10);
    assert.equal(parsed.metric, ANALYTICS_REPORTING_METRIC.ARTICLE_VIEWS);
  });

  it("rejects a non-uuid category filter", () => {
    try {
      parseAnalyticsReportQuery(
        new URL(
          "https://editor.example/api/analytics/content?from=2026-08-01&to=2026-08-07&categoryId=not-a-uuid",
        ),
      );
      assert.fail("expected throw");
    } catch (error) {
      assert.equal(error instanceof EditorHttpError, true);
      if (error instanceof EditorHttpError) {
        assert.equal(error.code, EDITOR_API_ERROR.INVALID_REQUEST);
      }
    }
  });

  it("blocks sensitive analytics DTO keys", () => {
    assert.equal(assertSafeAnalyticsDto({ articleViews: 3 }), undefined);
    try {
      assertSafeAnalyticsDto({ eventId: "secret" });
      assert.fail("expected throw");
    } catch (error) {
      assert.equal(error instanceof Error, true);
    }
  });
});
