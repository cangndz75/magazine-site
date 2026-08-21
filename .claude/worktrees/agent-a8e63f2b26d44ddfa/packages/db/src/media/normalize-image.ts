import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  MEDIA_IMAGE_MAX_BYTES,
  MEDIA_IMAGE_MAX_PIXELS,
  MEDIA_IMAGE_MIME,
  MEDIA_UPLOAD_ERROR,
  MediaUploadError,
  assertDecodedImageConstraints,
  type MediaImageFormat,
} from "@magazine/domain";

export type NormalizedUploadImage = {
  bytes: Buffer;
  format: MediaImageFormat;
  mimeType: string;
  width: number;
  height: number;
  contentHash: string;
};

function looksLikeSvg(bytes: Buffer): boolean {
  const head = bytes.subarray(0, 256).toString("utf8").toLowerCase().trim();
  return (
    head.startsWith("<svg") ||
    head.includes("<svg") ||
    (head.startsWith("<?xml") && head.includes("<svg"))
  );
}

function toMediaFormat(format: string | undefined): MediaImageFormat | null {
  if (format === "jpeg" || format === "jpg") {
    return "jpeg";
  }
  if (format === "png" || format === "webp" || format === "avif") {
    return format;
  }
  return null;
}

async function encodeNormalized(
  image: sharp.Sharp,
  format: MediaImageFormat,
): Promise<Buffer> {
  return encodeNormalizedFormat(image.rotate(), format);
}

export async function encodeNormalizedFormat(
  image: sharp.Sharp,
  format: MediaImageFormat,
): Promise<Buffer> {
  switch (format) {
    case "jpeg":
      return image.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    case "png":
      return image.png({ compressionLevel: 8 }).toBuffer();
    case "webp":
      return image.webp({ quality: 90 }).toBuffer();
    case "avif":
      return image.avif({ quality: 55 }).toBuffer();
    default:
      throw new MediaUploadError(MEDIA_UPLOAD_ERROR.UNSUPPORTED_FORMAT);
  }
}

export async function normalizeUploadedImage(
  inputBytes: Buffer,
): Promise<NormalizedUploadImage> {
  if (inputBytes.byteLength === 0) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.EMPTY_FILE);
  }
  if (inputBytes.byteLength > MEDIA_IMAGE_MAX_BYTES) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE);
  }
  if (looksLikeSvg(inputBytes)) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.UNSUPPORTED_FORMAT);
  }

  try {
    const pipeline = sharp(inputBytes, {
      failOn: "error",
      limitInputPixels: MEDIA_IMAGE_MAX_PIXELS,
      sequentialRead: true,
      animated: false,
    });
    const metadata = await pipeline.metadata();
    const format = toMediaFormat(metadata.format);
    if (!format) {
      throw new MediaUploadError(MEDIA_UPLOAD_ERROR.UNSUPPORTED_FORMAT);
    }
    const limits = assertDecodedImageConstraints({
      format,
      width: metadata.width,
      height: metadata.height,
      byteSize: inputBytes.byteLength,
    });
    if (!limits.ok) {
      throw new MediaUploadError(limits.code);
    }

    const normalized = await encodeNormalized(pipeline, format);
    const outputMeta = await sharp(normalized, {
      failOn: "error",
      limitInputPixels: MEDIA_IMAGE_MAX_PIXELS,
    }).metadata();
    const outputLimits = assertDecodedImageConstraints({
      format,
      width: outputMeta.width,
      height: outputMeta.height,
      byteSize: normalized.byteLength,
    });
    if (!outputLimits.ok) {
      throw new MediaUploadError(outputLimits.code);
    }

    return {
      bytes: normalized,
      format,
      mimeType: MEDIA_IMAGE_MIME[format],
      width: outputLimits.value.width,
      height: outputLimits.value.height,
      contentHash: createHash("sha256").update(normalized).digest("hex"),
    };
  } catch (error) {
    if (error instanceof MediaUploadError) {
      throw error;
    }
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.INVALID_IMAGE);
  }
}
