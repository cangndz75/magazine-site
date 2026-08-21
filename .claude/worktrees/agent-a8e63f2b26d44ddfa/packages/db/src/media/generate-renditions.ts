import sharp from "sharp";
import {
  MEDIA_IMAGE_MAX_PIXELS,
  MEDIA_UPLOAD_ERROR,
  MediaUploadError,
  generateMediaRenditionStorageKey,
  plannedRenditionSizes,
  type MediaImageFormat,
  type MediaRenditionVariant,
} from "@magazine/domain";
import { encodeNormalizedFormat, type NormalizedUploadImage } from "./normalize-image";

export type GeneratedImageRendition = {
  variant: MediaRenditionVariant;
  storageKey: string;
  bytes: Buffer;
  width: number;
  height: number;
  byteSize: number;
};

export async function generateImageRenditions(input: {
  originalStorageKey: string;
  normalized: NormalizedUploadImage;
}): Promise<GeneratedImageRendition[]> {
  const planned = plannedRenditionSizes({
    width: input.normalized.width,
    height: input.normalized.height,
  });
  const generated: GeneratedImageRendition[] = [];

  for (const [variant, size] of Object.entries(planned) as Array<
    [MediaRenditionVariant, { width: number; height: number }]
  >) {
    const key = generateMediaRenditionStorageKey(input.originalStorageKey, variant);
    if (!key.ok) {
      throw new MediaUploadError(key.code);
    }
    const bytes = await encodeRendition({
      source: input.normalized.bytes,
      format: input.normalized.format,
      width: size.width,
      height: size.height,
    });
    generated.push({
      variant,
      storageKey: key.value,
      bytes,
      width: size.width,
      height: size.height,
      byteSize: bytes.byteLength,
    });
  }

  return generated;
}

async function encodeRendition(input: {
  source: Buffer;
  format: MediaImageFormat;
  width: number;
  height: number;
}): Promise<Buffer> {
  try {
    const pipeline = sharp(input.source, {
      failOn: "error",
      limitInputPixels: MEDIA_IMAGE_MAX_PIXELS,
      sequentialRead: true,
      animated: false,
    }).resize({
      width: input.width,
      height: input.height,
      fit: "fill",
      withoutEnlargement: true,
    });
    return await encodeNormalizedFormat(pipeline, input.format);
  } catch (error) {
    if (error instanceof MediaUploadError) {
      throw error;
    }
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.INVALID_IMAGE);
  }
}
