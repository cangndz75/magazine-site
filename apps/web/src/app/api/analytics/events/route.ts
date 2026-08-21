import { env } from "@/lib/env";
import {
  createWebAnalyticsIngestDeps,
  handleAnalyticsIngestMethodNotAllowed,
  handleAnalyticsIngestPost,
} from "@/lib/analytics/ingest-http";

export const dynamic = "force-dynamic";

export function GET() {
  return handleAnalyticsIngestMethodNotAllowed();
}

export async function POST(request: Request) {
  return handleAnalyticsIngestPost(
    request,
    createWebAnalyticsIngestDeps({
      appEnv: env.APP_ENV,
      siteUrl: env.SITE_URL,
      analyticsContextSigningKey: env.ANALYTICS_CONTEXT_SIGNING_KEY,
    }),
  );
}
