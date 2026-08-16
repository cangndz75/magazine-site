export function assertEditorOrigin(
  request: Request,
  editorUrl: string,
): void {
  const expectedOrigin = new URL(editorUrl).origin;
  const originHeader = request.headers.get("origin");

  if (originHeader) {
    if (originHeader !== expectedOrigin) {
      throw new Error("Cross-origin request rejected");
    }
    return;
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    throw new Error("Missing request origin");
  }

  let refererOrigin: string;
  try {
    refererOrigin = new URL(referer).origin;
  } catch {
    throw new Error("Cross-origin request rejected");
  }

  if (refererOrigin !== expectedOrigin) {
    throw new Error("Cross-origin request rejected");
  }
}
