import { env } from "@/lib/env";
import { processPublicCacheOutboxBatch } from "@/lib/content/public-cache-outbox-processor";
import {
  SCHEDULED_PUBLISH_RUNNER_ERROR,
  ScheduledPublishRunnerError,
  assertScheduledPublishRunnerAuthorized,
} from "@/lib/content/scheduled-publish-runner";

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
    assertScheduledPublishRunnerAuthorized(
      request,
      env.SCHEDULED_PUBLISH_RUNNER_SECRET,
    );
    const body = await readOptionalJson(request);
    const limit =
      typeof body?.limit === "number" && Number.isInteger(body.limit)
        ? body.limit
        : undefined;
    const summary = await processPublicCacheOutboxBatch({ limit });
    return jsonResponse({ ok: true, summary }, 200);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse(
        { ok: false, error: SCHEDULED_PUBLISH_RUNNER_ERROR.INVALID_REQUEST },
        400,
      );
    }

    if (error instanceof ScheduledPublishRunnerError) {
      return jsonResponse({ ok: false, error: error.code }, error.status);
    }

    throw error;
  }
}

async function readOptionalJson(
  request: Request,
): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.trim().length === 0) {
    return null;
  }

  const parsed = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new SyntaxError("Invalid JSON body.");
  }

  return parsed as Record<string, unknown>;
}
