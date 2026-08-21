import type { MetadataRoute } from "next";
import { buildPublicRobotsDocument } from "@magazine/domain";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return buildPublicRobotsDocument({
    appEnv: env.APP_ENV,
    trustedSiteUrl: env.SITE_URL,
  });
}
