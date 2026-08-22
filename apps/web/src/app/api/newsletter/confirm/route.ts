import { env } from "@/lib/env";
import {
  createNewsletterHttpDeps,
  handleNewsletterConfirmRequest,
  handleNewsletterMethodNotAllowed,
} from "@/lib/newsletter/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleNewsletterConfirmRequest(
    request,
    createNewsletterHttpDeps({ siteUrl: env.SITE_URL }),
  );
}

export function POST() {
  return handleNewsletterMethodNotAllowed();
}
