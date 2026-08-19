import { env } from "@/lib/env";
import { handlePublicCacheInvalidationPost } from "@/lib/public-cache-invalidation-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlePublicCacheInvalidationPost(
    request,
    env.PUBLIC_CACHE_INVALIDATION_SECRET,
  );
}
