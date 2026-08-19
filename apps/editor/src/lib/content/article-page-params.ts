import { isUuid, safeInternalPath } from "@magazine/domain";

export type ArticlePageQuery = {
  versionId: string | undefined;
  versionIdInvalid: boolean;
  fromReview: boolean;
  returnHref: string;
};

export function parseArticleSearchParams(
  params: Record<string, string | string[] | undefined>,
): ArticlePageQuery {
  const versionRaw =
    typeof params.versionId === "string" ? params.versionId : undefined;
  const versionIdInvalid = Boolean(versionRaw && !isUuid(versionRaw));
  const versionId =
    versionRaw && isUuid(versionRaw) ? versionRaw : undefined;

  const fromRaw = typeof params.from === "string" ? params.from : undefined;
  const fromReview = fromRaw === "review";

  const returnRaw =
    typeof params.returnTo === "string" ? params.returnTo : null;

  return {
    versionId,
    versionIdInvalid,
    fromReview,
    returnHref: safeInternalPath(returnRaw),
  };
}
