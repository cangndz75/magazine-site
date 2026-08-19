import { env } from "@/lib/env";
import {
  SCHEDULED_PUBLISH_RUNNER_ERROR,
  ScheduledPublishRunnerError,
  assertScheduledPublishRunnerAuthorized,
  parseScheduledPublishJobPayload,
  runScheduledPublishJob,
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

    const payload = parseScheduledPublishJobPayload(await request.json());
    const result = await runScheduledPublishJob(payload);
    return jsonResponse({ ok: true, result }, 200);
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
