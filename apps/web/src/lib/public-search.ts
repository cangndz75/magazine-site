import "server-only";

import { searchPublic } from "@magazine/db/search";
import type { SearchFilter } from "@magazine/domain";
import { env } from "./env";

export async function getPublicSearchResults(input: {
  query: string;
  filter: SearchFilter;
  cursor?: string | null;
  limit?: number;
}) {
  return searchPublic(
    {
      query: input.query,
      filter: input.filter,
      cursor: input.cursor ?? null,
      limit: input.limit,
    },
    { mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL },
  );
}
