import "server-only";

import { cache } from "react";
import { getPublicHomepage as loadPublicHomepage } from "@magazine/db/public";
import { env } from "./env";

export const getPublicHomepage = cache(() =>
  loadPublicHomepage({
    mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
  }),
);
