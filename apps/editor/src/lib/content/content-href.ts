export type ArticleHrefInput = {
  contentItemId: string;
  versionId?: string | null;
  from?: "review" | null;
  returnTo?: string | null;
};

export function buildArticleHref(input: ArticleHrefInput): string {
  const params = new URLSearchParams();

  if (input.versionId) {
    params.set("versionId", input.versionId);
  }

  if (input.from === "review") {
    params.set("from", "review");
  }

  if (input.returnTo && input.returnTo !== "/") {
    params.set("returnTo", input.returnTo);
  }

  const qs = params.toString();
  return qs ? `/content/${input.contentItemId}?${qs}` : `/content/${input.contentItemId}`;
}

export function buildListReturnTo(search: string, pathname = "/"): string {
  return search ? `${pathname}?${search}` : pathname;
}
