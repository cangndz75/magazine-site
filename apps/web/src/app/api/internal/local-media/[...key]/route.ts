import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  localMediaContentType,
  resolveLocalMediaFilePath,
} from "@/lib/local-media";

export const dynamic = "force-dynamic";

function mediaRoot(): string {
  return path.resolve(process.cwd(), "public/media");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> },
) {
  const { key } = await context.params;
  const filePath = resolveLocalMediaFilePath(mediaRoot(), key);
  const contentType = filePath ? localMediaContentType(filePath) : null;
  if (!filePath || !contentType) {
    return new Response(null, { status: 404 });
  }

  try {
    const body = await readFile(filePath);
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=3600, immutable",
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "ENOENT"
    ) {
      return new Response(null, { status: 404 });
    }
    return new Response(null, { status: 404 });
  }
}
