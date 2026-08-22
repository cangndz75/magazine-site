import { env } from "@/lib/env";
import {
  createNewsletterHttpDeps,
  handleNewsletterMethodNotAllowed,
  handleNewsletterUnsubscribeRequest,
} from "@/lib/newsletter/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleNewsletterUnsubscribeRequest(
    request,
    createNewsletterHttpDeps({ siteUrl: env.SITE_URL }),
  );
}

export function POST() {
  return handleNewsletterMethodNotAllowed();
}
