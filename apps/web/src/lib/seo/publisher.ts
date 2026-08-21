import { resolvePublicPublisherIdentity } from "@magazine/domain";
import { env } from "@/lib/env";

export function configuredPublicPublisher() {
  return resolvePublicPublisherIdentity({
    name: env.SITE_PUBLISHER_NAME,
    url: env.SITE_PUBLISHER_URL,
    logoUrl: env.SITE_PUBLISHER_LOGO_URL,
  });
}
