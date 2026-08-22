import { env } from "@/lib/env";
import {
  createNewsletterHttpDeps,
  handleNewsletterMethodNotAllowed,
  handleNewsletterSubscribePost,
} from "@/lib/newsletter/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handleNewsletterMethodNotAllowed();
}

export async function POST(request: Request) {
  return handleNewsletterSubscribePost(
    request,
    createNewsletterHttpDeps({ siteUrl: env.SITE_URL }),
  );
}
