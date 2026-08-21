/**
 * Version `robots` is a free-form text column. Public output never serializes
 * the raw string. Tokens are normalized into a fail-closed restriction:
 * the editor may only make an otherwise indexable article more restrictive.
 */

export const SEO_ROBOTS_DIRECTIVE = {
  DEFAULT: "DEFAULT",
  NOINDEX: "NOINDEX",
} as const;

export type SeoRobotsDirective =
  (typeof SEO_ROBOTS_DIRECTIVE)[keyof typeof SEO_ROBOTS_DIRECTIVE];

const KNOWN_TOKENS = new Set([
  "index",
  "follow",
  "noindex",
  "nofollow",
  "all",
  "none",
]);

export type SeoRobotsOverride = {
  directive: SeoRobotsDirective;
  tokens: string[];
  unrecognized: boolean;
};

export function parseSeoRobotsOverride(
  storedRobots: string | null | undefined,
): SeoRobotsOverride {
  if (typeof storedRobots !== "string") {
    return {
      directive: SEO_ROBOTS_DIRECTIVE.DEFAULT,
      tokens: [],
      unrecognized: false,
    };
  }

  const tokens = storedRobots
    .split(/[\s,;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return {
      directive: SEO_ROBOTS_DIRECTIVE.DEFAULT,
      tokens: [],
      unrecognized: false,
    };
  }

  const noindex = tokens.some(
    (token) => token === "noindex" || token === "none",
  );
  const unrecognized = tokens.some((token) => !KNOWN_TOKENS.has(token));

  return {
    directive: noindex
      ? SEO_ROBOTS_DIRECTIVE.NOINDEX
      : SEO_ROBOTS_DIRECTIVE.DEFAULT,
    tokens,
    unrecognized,
  };
}
