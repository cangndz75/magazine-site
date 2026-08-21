import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MEDIA_UPLOAD_ERROR,
  MediaUploadError,
  assertSafeMediaStorageKey,
} from "@magazine/domain";
import type { MediaObjectPutInput, MediaObjectStore } from "./types";

export function createLocalMediaObjectStore(root: string): MediaObjectStore {
  const resolvedRoot = path.resolve(root);

  function resolveKeyPath(key: string): string {
    const decision = assertSafeMediaStorageKey(key);
    if (!decision.ok) {
      throw new MediaUploadError(MEDIA_UPLOAD_ERROR.INVALID_UPLOAD);
    }
    const absolute = path.resolve(resolvedRoot, ...decision.value.split("/"));
    const relative = path.relative(resolvedRoot, absolute);
    if (
      relative.startsWith("..") ||
      path.isAbsolute(relative) ||
      relative.includes("\0")
    ) {
      throw new MediaUploadError(MEDIA_UPLOAD_ERROR.INVALID_UPLOAD);
    }
    return absolute;
  }

  return {
    async put(input: MediaObjectPutInput) {
      const filePath = resolveKeyPath(input.key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, input.body);
    },
    async delete(key: string) {
      const filePath = resolveKeyPath(key);
      try {
        await unlink(filePath);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "ENOENT"
        ) {
          return;
        }
        throw new MediaUploadError(MEDIA_UPLOAD_ERROR.STORAGE_FAILED);
      }
    },
  };
}
