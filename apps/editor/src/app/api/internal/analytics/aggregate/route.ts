import { env } from "@/lib/env";
import {
  aggregateAnalyticsWindow,
  aggregateRecentAnalyticsWindow,
} from "@magazine/db/analytics";
import {
  AnalyticsAggregationRunnerError,
  assertAnalyticsAggregationAuthorized,
} from "@/lib/analytics/aggregate-runner";
import { parseAnalyticsAggregateBody } from "@/lib/analytics/query";
import { EditorHttpError, mapEditorError } from "@/lib/content/http";

export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  try {
    assertAnalyticsAggregationAuthorized(
      request,
      env.ANALYTICS_AGGREGATION_SECRET,
    );

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const range = parseAnalyticsAggregateBody(body);
    const result =
      range.from && range.to
        ? await aggregateAnalyticsWindow({ from: range.from, to: range.to })
        : await aggregateRecentAnalyticsWindow();

    if (!result.ok) {
      throw new EditorHttpError(400, result.code, "The request is invalid.");
    }

    return jsonResponse(
      {
        ok: true,
        fromInclusive: result.fromInclusive.toISOString(),
        toExclusive: result.toExclusive.toISOString(),
        quality: result.quality,
      },
      200,
    );
  } catch (error) {
    if (error instanceof AnalyticsAggregationRunnerError) {
      return jsonResponse({ ok: false, error: error.code }, error.status);
    }
    if (error instanceof SyntaxError) {
      return jsonResponse(
        { ok: false, error: "INVALID_REQUEST" },
        400,
      );
    }
    return mapEditorError(error);
  }
}
