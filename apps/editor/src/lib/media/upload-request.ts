import {
  MEDIA_UPLOAD_ERROR,
  MEDIA_UPLOAD_MAX_REQUEST_BYTES,
  MediaUploadError,
} from "@magazine/domain";

export type ParsedMediaUploadFile = {
  bytes: Buffer;
  originalFilename: string | null;
};

function isFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export async function readMediaUploadFile(request: Request): Promise<ParsedMediaUploadFile> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.INVALID_UPLOAD);
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > MEDIA_UPLOAD_MAX_REQUEST_BYTES) {
      throw new MediaUploadError(MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE);
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.INVALID_UPLOAD);
  }

  const entries = form.getAll("file");
  if (entries.length === 0) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.EMPTY_FILE);
  }
  if (entries.length > 1) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.INVALID_UPLOAD);
  }

  const value = entries[0];
  if (!isFile(value)) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.INVALID_UPLOAD);
  }
  if (value.size <= 0) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.EMPTY_FILE);
  }
  if (value.size > MEDIA_UPLOAD_MAX_REQUEST_BYTES) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE);
  }

  const bytes = Buffer.from(await value.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.EMPTY_FILE);
  }
  if (bytes.byteLength > MEDIA_UPLOAD_MAX_REQUEST_BYTES) {
    throw new MediaUploadError(MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE);
  }

  return {
    bytes,
    originalFilename: value.name || null,
  };
}
