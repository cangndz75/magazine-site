import { hasCapability } from "./authorization";
import { CAPABILITY } from "./capability";
import type { StaffRole } from "./staff-role";

export const MEDIA_UPLOAD_ERROR = {
  FORBIDDEN: "FORBIDDEN",
  EMPTY_FILE: "EMPTY_FILE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  UNSUPPORTED_FORMAT: "UNSUPPORTED_FORMAT",
  INVALID_IMAGE: "INVALID_IMAGE",
  DIMENSIONS_EXCEEDED: "DIMENSIONS_EXCEEDED",
  STORAGE_FAILED: "STORAGE_FAILED",
  STORAGE_NOT_CONFIGURED: "STORAGE_NOT_CONFIGURED",
  INVALID_UPLOAD: "INVALID_UPLOAD",
} as const;

export type MediaUploadErrorCode =
  (typeof MEDIA_UPLOAD_ERROR)[keyof typeof MEDIA_UPLOAD_ERROR];

export class MediaUploadError extends Error {
  readonly code: MediaUploadErrorCode;

  constructor(code: MediaUploadErrorCode, message: string = code) {
    super(message);
    this.name = "MediaUploadError";
    this.code = code;
  }
}

export type MediaUploadDecision<T> =
  | { ok: true; value: T }
  | { ok: false; code: MediaUploadErrorCode };

export const MEDIA_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
export const MEDIA_UPLOAD_MAX_REQUEST_BYTES = MEDIA_IMAGE_MAX_BYTES + 256 * 1024;
export const MEDIA_IMAGE_MAX_WIDTH = 8_000;
export const MEDIA_IMAGE_MAX_HEIGHT = 8_000;
export const MEDIA_IMAGE_MAX_PIXELS = 36_000_000;
export const MEDIA_ORIGINAL_FILENAME_MAX = 200;

export const MEDIA_IMAGE_FORMAT = {
  JPEG: "jpeg",
  PNG: "png",
  WEBP: "webp",
  AVIF: "avif",
} as const;

export type MediaImageFormat =
  (typeof MEDIA_IMAGE_FORMAT)[keyof typeof MEDIA_IMAGE_FORMAT];

export const MEDIA_IMAGE_FORMATS = [
  MEDIA_IMAGE_FORMAT.JPEG,
  MEDIA_IMAGE_FORMAT.PNG,
  MEDIA_IMAGE_FORMAT.WEBP,
  MEDIA_IMAGE_FORMAT.AVIF,
] as const;

export const MEDIA_IMAGE_MIME = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
} as const;

export const MEDIA_IMAGE_EXTENSION = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  avif: "avif",
} as const;

export function isMediaImageFormat(value: string): value is MediaImageFormat {
  return (MEDIA_IMAGE_FORMATS as readonly string[]).includes(value);
}

export function authorizeMediaUpload(input: {
  roles: readonly StaffRole[];
}): MediaUploadDecision<true> {
  if (!hasCapability(input.roles, CAPABILITY.CONTENT_EDIT)) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.FORBIDDEN };
  }
  return { ok: true, value: true };
}

export function assertDecodedImageConstraints(input: {
  format: string;
  width: number | undefined;
  height: number | undefined;
  byteSize: number;
}): MediaUploadDecision<{
  format: MediaImageFormat;
  width: number;
  height: number;
}> {
  if (input.byteSize <= 0) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.EMPTY_FILE };
  }
  if (input.byteSize > MEDIA_IMAGE_MAX_BYTES) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE };
  }
  if (!isMediaImageFormat(input.format)) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.UNSUPPORTED_FORMAT };
  }
  const width = input.width ?? 0;
  const height = input.height ?? 0;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.INVALID_IMAGE };
  }
  if (
    width > MEDIA_IMAGE_MAX_WIDTH ||
    height > MEDIA_IMAGE_MAX_HEIGHT ||
    width * height > MEDIA_IMAGE_MAX_PIXELS
  ) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.DIMENSIONS_EXCEEDED };
  }
  return { ok: true, value: { format: input.format, width, height } };
}

export function canonicalizeOriginalFilename(
  raw: string | null | undefined,
  format: MediaImageFormat,
): string {
  const fallback = `image.${MEDIA_IMAGE_EXTENSION[format]}`;
  if (!raw) {
    return fallback;
  }
  const basename = raw.replace(/\\/g, "/").split("/").pop() ?? "";
  const withoutNulls = basename.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const strippedTraversal = withoutNulls.replace(/^\.+/, "").trim();
  if (strippedTraversal.length === 0) {
    return fallback;
  }
  return strippedTraversal.slice(0, MEDIA_ORIGINAL_FILENAME_MAX);
}

export function generateMediaStorageKey(input: {
  now: Date;
  id: string;
  format: MediaImageFormat;
}): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.INVALID_UPLOAD);
  }
  const year = String(input.now.getUTCFullYear());
  const month = String(input.now.getUTCMonth() + 1).padStart(2, "0");
  const extension = MEDIA_IMAGE_EXTENSION[input.format];
  return `uploads/${year}/${month}/${input.id}.${extension}`;
}

export function assertSafeMediaStorageKey(key: string): MediaUploadDecision<string> {
  if (key.length === 0 || key.length > 240) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.INVALID_UPLOAD };
  }
  if (key.includes("\\") || key.includes("\0") || key.startsWith("/") || key.includes("..")) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.INVALID_UPLOAD };
  }
  const segments = key.split("/");
  if (segments.length !== 4 || segments[0] !== "uploads") {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.INVALID_UPLOAD };
  }
  if (!/^\d{4}$/.test(segments[1]) || !/^\d{2}$/.test(segments[2])) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.INVALID_UPLOAD };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif)$/i.test(segments[3])) {
    return { ok: false, code: MEDIA_UPLOAD_ERROR.INVALID_UPLOAD };
  }
  return { ok: true, value: key };
}
