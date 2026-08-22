import type { SearchFilter, SearchResultsDto } from "./types";

export type SearchProviderInput = {
  query: string;
  filter?: SearchFilter;
  limit?: number;
  cursor?: string | null;
};

export type SearchProviderContext = {
  mediaPublicBaseUrl?: string;
};

/**
 * Engine-agnostic public search boundary. UI must not query content tables directly.
 */
export interface SearchProvider {
  searchPublic(
    input: SearchProviderInput,
    context: SearchProviderContext,
  ): Promise<SearchResultsDto>;
}
