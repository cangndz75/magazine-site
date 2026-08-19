import { publicArticleInvalidationTags } from "@magazine/domain";
import {
  deliverPublicArticleCacheInvalidation,
  type PublicArticleCacheDeliveryTarget,
} from "./public-cache-delivery";

export type { PublicArticleCacheDeliveryTarget };

export { deliverPublicArticleCacheInvalidation, publicArticleInvalidationTags };
