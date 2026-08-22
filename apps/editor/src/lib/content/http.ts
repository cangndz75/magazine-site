import { NextResponse } from "next/server";
import {
  ContentLegalError,
  CONTENT_LEGAL_ERROR,
  CONVERSATION_ERROR,
  ConversationError,
  FEATURE_CONTROL_ERROR,
  FeatureControlError,
  type ContentLegalErrorCode,
  type ConversationErrorCode,
  type FeatureControlErrorCode,
  EDITOR_JSON_MAX_BYTES,
  HOMEPAGE_BUILDER_ERROR,
  HomepageBuilderError,
  MEDIA_RIGHTS_ERROR,
  MEDIA_UPLOAD_ERROR,
  MediaRightsError,
  MediaUploadError,
  PUBLISHING_ERROR,
  PublishingError,
  SEO_INSPECTION_ERROR,
  SeoInspectionError,
  STAFF_ADMIN_ERROR,
  STAFF_MFA_ERROR,
  StaffAdminError,
  StaffMfaError,
  ENTITY_ERROR,
  EntityError,
  type EntityErrorCode,
  VIDEO_ERROR,
  VideoError,
  type HomepageBuilderErrorCode,
  type MediaRightsErrorCode,
  type MediaUploadErrorCode,
  type PublishingErrorCode,
  type SeoInspectionErrorCode,
  type StaffAdminErrorCode,
  type StaffMfaErrorCode,
  type VideoErrorCode,
} from "@magazine/domain";

export const EDITOR_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
} as const;

export const EDITOR_API_ERROR = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  CROSS_ORIGIN_REJECTED: "CROSS_ORIGIN_REJECTED",
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_JSON: "INVALID_JSON",
  REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export class EditorHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "EditorHttpError";
    this.status = status;
    this.code = code;
  }
}

const PUBLISHING_STATUS: Record<PublishingErrorCode, number> = {
  [PUBLISHING_ERROR.CONTENT_NOT_FOUND]: 404,
  [PUBLISHING_ERROR.VERSION_NOT_FOUND]: 404,
  [PUBLISHING_ERROR.CONTENT_DELETED]: 404,
  [PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM]: 400,
  [PUBLISHING_ERROR.INVALID_SLUG]: 400,
  [PUBLISHING_ERROR.SLUG_CONFLICT]: 409,
  [PUBLISHING_ERROR.DRAFT_ALREADY_EXISTS]: 409,
  [PUBLISHING_ERROR.NO_REVISION_SOURCE]: 409,
  [PUBLISHING_ERROR.INVALID_WORKFLOW_TRANSITION]: 409,
  [PUBLISHING_ERROR.VERSION_NOT_CURRENT_DRAFT]: 409,
  [PUBLISHING_ERROR.VERSION_NOT_APPROVED]: 409,
  [PUBLISHING_ERROR.VERSION_NOT_EDITABLE]: 409,
  [PUBLISHING_ERROR.INVALID_PUBLISH_TARGET]: 409,
  [PUBLISHING_ERROR.PUBLISH_READINESS_FAILED]: 422,
  [PUBLISHING_ERROR.NOT_PUBLISHED]: 409,
  [PUBLISHING_ERROR.ALREADY_SCHEDULED]: 409,
  [PUBLISHING_ERROR.NO_SCHEDULE]: 409,
  [PUBLISHING_ERROR.SCHEDULE_NOT_IN_FUTURE]: 422,
  [PUBLISHING_ERROR.CANNOT_SCHEDULE_PUBLISHED_VERSION]: 422,
  [PUBLISHING_ERROR.STALE_SCHEDULE_GENERATION]: 409,
  [PUBLISHING_ERROR.DUPLICATE_RELATION]: 400,
  [PUBLISHING_ERROR.MULTIPLE_PRIMARY_CATEGORIES]: 400,
  [PUBLISHING_ERROR.MULTIPLE_HERO_MEDIA]: 400,
  [PUBLISHING_ERROR.INVALID_RELATION]: 400,
  [PUBLISHING_ERROR.RELATION_NOT_FOUND]: 400,
  [PUBLISHING_ERROR.INVALID_HERO_MEDIA]: 400,
  [PUBLISHING_ERROR.INVALID_GALLERY_MEDIA]: 400,
  [PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT]: 409,
  [PUBLISHING_ERROR.INVALID_TITLE]: 400,
  [PUBLISHING_ERROR.INVALID_BODY]: 400,
  [PUBLISHING_ERROR.INVALID_URL]: 400,
  [PUBLISHING_ERROR.SELECTED_SCOPE_PRIMARY_REQUIRED]: 400,
  [PUBLISHING_ERROR.CATEGORY_OUT_OF_SCOPE]: 403,
  [PUBLISHING_ERROR.INVALID_REVIEW_NOTE]: 400,
  [PUBLISHING_ERROR.CONTENT_BODY_CORRUPT]: 422,
  [PUBLISHING_ERROR.CONTENT_LEGAL_HOLD]: 409,
  [PUBLISHING_ERROR.CONTENT_LEGALLY_WITHDRAWN]: 409,
};

const HOMEPAGE_BUILDER_STATUS: Record<HomepageBuilderErrorCode, number> = {
  [HOMEPAGE_BUILDER_ERROR.FORBIDDEN]: 403,
  [HOMEPAGE_BUILDER_ERROR.INVALID_SLOT]: 400,
  [HOMEPAGE_BUILDER_ERROR.INVALID_CONTENT_ITEM]: 400,
  [HOMEPAGE_BUILDER_ERROR.INVALID_VIDEO_ASSET]: 400,
  [HOMEPAGE_BUILDER_ERROR.DUPLICATE_CONTENT_ITEM]: 409,
  [HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT]: 409,
  [HOMEPAGE_BUILDER_ERROR.NO_DRAFT]: 409,
  [HOMEPAGE_BUILDER_ERROR.PUBLISH_VALIDATION_FAILED]: 422,
};

const CONVERSATION_STATUS: Record<ConversationErrorCode, number> = {
  [CONVERSATION_ERROR.FORBIDDEN]: 403,
  [CONVERSATION_ERROR.ITEM_NOT_FOUND]: 404,
  [CONVERSATION_ERROR.INVALID_LABEL]: 400,
  [CONVERSATION_ERROR.INVALID_REASON]: 400,
  [CONVERSATION_ERROR.INVALID_CONTENT_ITEM]: 400,
  [CONVERSATION_ERROR.DUPLICATE_CONTENT_ITEM]: 409,
  [CONVERSATION_ERROR.LIMIT_EXCEEDED]: 409,
  [CONVERSATION_ERROR.INVALID_REORDER]: 400,
  [CONVERSATION_ERROR.WRITE_CONFLICT]: 409,
};

const FEATURE_CONTROL_STATUS: Record<FeatureControlErrorCode, number> = {
  [FEATURE_CONTROL_ERROR.FORBIDDEN]: 403,
  [FEATURE_CONTROL_ERROR.UNKNOWN_KEY]: 400,
  [FEATURE_CONTROL_ERROR.TYPE_MISMATCH]: 400,
  [FEATURE_CONTROL_ERROR.WRITE_CONFLICT]: 409,
  [FEATURE_CONTROL_ERROR.UNSAFE_AUDIT_PAYLOAD]: 500,
};

const MEDIA_RIGHTS_STATUS_MAP: Record<MediaRightsErrorCode, number> = {
  [MEDIA_RIGHTS_ERROR.FORBIDDEN]: 403,
  [MEDIA_RIGHTS_ERROR.MEDIA_NOT_FOUND]: 404,
  [MEDIA_RIGHTS_ERROR.INVALID_RIGHTS]: 400,
};

const MEDIA_UPLOAD_STATUS_MAP: Record<MediaUploadErrorCode, number> = {
  [MEDIA_UPLOAD_ERROR.FORBIDDEN]: 403,
  [MEDIA_UPLOAD_ERROR.EMPTY_FILE]: 400,
  [MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE]: 413,
  [MEDIA_UPLOAD_ERROR.UNSUPPORTED_FORMAT]: 415,
  [MEDIA_UPLOAD_ERROR.INVALID_IMAGE]: 400,
  [MEDIA_UPLOAD_ERROR.DIMENSIONS_EXCEEDED]: 400,
  [MEDIA_UPLOAD_ERROR.STORAGE_FAILED]: 500,
  [MEDIA_UPLOAD_ERROR.STORAGE_NOT_CONFIGURED]: 503,
  [MEDIA_UPLOAD_ERROR.INVALID_UPLOAD]: 400,
};

const VIDEO_STATUS_MAP: Record<VideoErrorCode, number> = {
  [VIDEO_ERROR.FORBIDDEN]: 403,
  [VIDEO_ERROR.NOT_FOUND]: 404,
  [VIDEO_ERROR.UNSUPPORTED_PROVIDER]: 400,
  [VIDEO_ERROR.INVALID_VIDEO_URL]: 400,
  [VIDEO_ERROR.INVALID_PROVIDER_ID]: 400,
  [VIDEO_ERROR.DUPLICATE_VIDEO]: 409,
  [VIDEO_ERROR.INVALID_POSTER]: 400,
  [VIDEO_ERROR.INVALID_METADATA]: 400,
  [VIDEO_ERROR.STALE_WRITE]: 409,
};

const SEO_INSPECTION_STATUS: Record<SeoInspectionErrorCode, number> = {
  [SEO_INSPECTION_ERROR.FORBIDDEN]: 403,
  [SEO_INSPECTION_ERROR.CONTENT_NOT_FOUND]: 404,
};

const CONTENT_LEGAL_STATUS: Record<ContentLegalErrorCode, number> = {
  [CONTENT_LEGAL_ERROR.FORBIDDEN]: 403,
  [CONTENT_LEGAL_ERROR.CONTENT_NOT_FOUND]: 404,
  [CONTENT_LEGAL_ERROR.CONTENT_DELETED]: 404,
  [CONTENT_LEGAL_ERROR.CONTENT_WRITE_CONFLICT]: 409,
  [CONTENT_LEGAL_ERROR.INVALID_LEGAL_ACTION]: 400,
  [CONTENT_LEGAL_ERROR.NOT_PUBLISHED]: 409,
  [CONTENT_LEGAL_ERROR.ALREADY_RETRACTED]: 409,
  [CONTENT_LEGAL_ERROR.ALREADY_TAKEN_DOWN]: 409,
  [CONTENT_LEGAL_ERROR.LEGAL_HOLD_ALREADY_ACTIVE]: 409,
  [CONTENT_LEGAL_ERROR.LEGAL_HOLD_NOT_ACTIVE]: 409,
  [CONTENT_LEGAL_ERROR.INVALID_NOTE]: 400,
};

export const STAFF_ADMIN_HTTP_ERROR = {
  FORBIDDEN: STAFF_ADMIN_ERROR.FORBIDDEN,
  STAFF_NOT_FOUND: STAFF_ADMIN_ERROR.STAFF_NOT_FOUND,
  STAFF_WRITE_CONFLICT: STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT,
  LAST_SUPER_ADMIN: STAFF_ADMIN_ERROR.LAST_SUPER_ADMIN,
  SESSION_NOT_FOUND: STAFF_ADMIN_ERROR.SESSION_NOT_FOUND,
  MFA_NOT_ENROLLED: STAFF_ADMIN_ERROR.MFA_NOT_ENROLLED,
  INVALID_STAFF_ROLE: "INVALID_STAFF_ROLE",
  INVALID_STAFF_SCOPE: "INVALID_STAFF_SCOPE",
  INVALID_ACCOUNT_TRANSITION: "INVALID_ACCOUNT_TRANSITION",
} as const;

const STAFF_ADMIN_HTTP_CODE: Record<StaffAdminErrorCode, string> = {
  [STAFF_ADMIN_ERROR.FORBIDDEN]: STAFF_ADMIN_HTTP_ERROR.FORBIDDEN,
  [STAFF_ADMIN_ERROR.STAFF_NOT_FOUND]: STAFF_ADMIN_HTTP_ERROR.STAFF_NOT_FOUND,
  [STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT]:
    STAFF_ADMIN_HTTP_ERROR.STAFF_WRITE_CONFLICT,
  [STAFF_ADMIN_ERROR.LAST_SUPER_ADMIN]: STAFF_ADMIN_HTTP_ERROR.LAST_SUPER_ADMIN,
  [STAFF_ADMIN_ERROR.INVALID_ROLE]: STAFF_ADMIN_HTTP_ERROR.INVALID_STAFF_ROLE,
  [STAFF_ADMIN_ERROR.INVALID_SCOPE]: STAFF_ADMIN_HTTP_ERROR.INVALID_STAFF_SCOPE,
  [STAFF_ADMIN_ERROR.INVALID_STATUS]:
    STAFF_ADMIN_HTTP_ERROR.INVALID_ACCOUNT_TRANSITION,
  [STAFF_ADMIN_ERROR.SESSION_NOT_FOUND]: STAFF_ADMIN_HTTP_ERROR.SESSION_NOT_FOUND,
  [STAFF_ADMIN_ERROR.MFA_NOT_ENROLLED]: STAFF_ADMIN_HTTP_ERROR.MFA_NOT_ENROLLED,
};

const STAFF_ADMIN_STATUS: Record<StaffAdminErrorCode, number> = {
  [STAFF_ADMIN_ERROR.FORBIDDEN]: 403,
  [STAFF_ADMIN_ERROR.STAFF_NOT_FOUND]: 404,
  [STAFF_ADMIN_ERROR.STAFF_WRITE_CONFLICT]: 409,
  [STAFF_ADMIN_ERROR.LAST_SUPER_ADMIN]: 409,
  [STAFF_ADMIN_ERROR.INVALID_ROLE]: 400,
  [STAFF_ADMIN_ERROR.INVALID_SCOPE]: 400,
  [STAFF_ADMIN_ERROR.INVALID_STATUS]: 400,
  [STAFF_ADMIN_ERROR.SESSION_NOT_FOUND]: 404,
  [STAFF_ADMIN_ERROR.MFA_NOT_ENROLLED]: 409,
};

const STAFF_MFA_STATUS: Record<StaffMfaErrorCode, number> = {
  [STAFF_MFA_ERROR.FORBIDDEN]: 403,
  [STAFF_MFA_ERROR.MFA_NOT_ENROLLED]: 409,
  [STAFF_MFA_ERROR.MFA_ALREADY_ACTIVE]: 409,
  [STAFF_MFA_ERROR.MFA_ENROLLMENT_PENDING]: 409,
  [STAFF_MFA_ERROR.MFA_ENROLLMENT_NOT_PENDING]: 409,
  [STAFF_MFA_ERROR.INVALID_TOTP_CODE]: 400,
  [STAFF_MFA_ERROR.INVALID_RECOVERY_CODE]: 400,
  [STAFF_MFA_ERROR.CHALLENGE_NOT_FOUND]: 404,
  [STAFF_MFA_ERROR.CHALLENGE_EXPIRED]: 410,
  [STAFF_MFA_ERROR.CHALLENGE_CONSUMED]: 409,
  [STAFF_MFA_ERROR.CHALLENGE_LOCKED]: 429,
  [STAFF_MFA_ERROR.TOTP_REPLAY]: 409,
  [STAFF_MFA_ERROR.CRYPTO_ERROR]: 500,
  [STAFF_MFA_ERROR.STEP_UP_REQUIRED]: 401,
};

const ENTITY_STATUS_MAP: Record<EntityErrorCode, number> = {
  [ENTITY_ERROR.FORBIDDEN]: 403,
  [ENTITY_ERROR.ENTITY_NOT_FOUND]: 404,
  [ENTITY_ERROR.ENTITY_WRITE_CONFLICT]: 409,
  [ENTITY_ERROR.ENTITY_DELETED]: 404,
  [ENTITY_ERROR.INVALID_NAME]: 400,
  [ENTITY_ERROR.INVALID_SLUG]: 400,
  [ENTITY_ERROR.SLUG_CONFLICT]: 409,
  [ENTITY_ERROR.INVALID_ALIAS]: 400,
  [ENTITY_ERROR.DUPLICATE_ALIAS]: 400,
  [ENTITY_ERROR.ALIAS_LIMIT]: 400,
  [ENTITY_ERROR.INVALID_STATUS]: 409,
  [ENTITY_ERROR.INVALID_KIND]: 400,
  [ENTITY_ERROR.INVALID_PROFILE]: 400,
  [ENTITY_ERROR.INVALID_URL]: 400,
  [ENTITY_ERROR.INVALID_MEDIA]: 400,
  [ENTITY_ERROR.INVALID_RELATION]: 400,
  [ENTITY_ERROR.INVALID_MERGE]: 400,
};

const SAFE_MESSAGES: Record<string, string> = {
  [EDITOR_API_ERROR.UNAUTHENTICATED]: "Authentication required.",
  [EDITOR_API_ERROR.FORBIDDEN]: "You are not allowed to perform this action.",
  [EDITOR_API_ERROR.CROSS_ORIGIN_REJECTED]: "Cross-origin request rejected.",
  [EDITOR_API_ERROR.INVALID_REQUEST]: "The request is invalid.",
  [EDITOR_API_ERROR.INVALID_JSON]: "The request body is not valid JSON.",
  [EDITOR_API_ERROR.REQUEST_TOO_LARGE]: "The request body is too large.",
  [EDITOR_API_ERROR.INTERNAL_ERROR]: "An unexpected error occurred.",
  [PUBLISHING_ERROR.CONTENT_NOT_FOUND]: "Content was not found.",
  [PUBLISHING_ERROR.VERSION_NOT_FOUND]: "Version was not found.",
  [PUBLISHING_ERROR.CONTENT_DELETED]: "Content was not found.",
  [PUBLISHING_ERROR.INVALID_SLUG]: "URL geçersiz.",
  [PUBLISHING_ERROR.SLUG_CONFLICT]: "Bu URL kullanımda.",
  [PUBLISHING_ERROR.CONTENT_WRITE_CONFLICT]:
    "This draft was updated elsewhere. Reload and try again.",
  [PUBLISHING_ERROR.CATEGORY_OUT_OF_SCOPE]:
    "One or more categories are outside your assigned scope.",
  [PUBLISHING_ERROR.RELATION_NOT_FOUND]:
    "A selected category, tag, author, entity, or media record no longer exists.",
  [PUBLISHING_ERROR.DUPLICATE_RELATION]:
    "The same relation cannot be attached twice.",
  [PUBLISHING_ERROR.INVALID_RELATION]: "A relation in the request is invalid.",
  [PUBLISHING_ERROR.INVALID_HERO_MEDIA]:
    "Kapak görseli yalnızca bir görsel olabilir.",
  [PUBLISHING_ERROR.INVALID_GALLERY_MEDIA]:
    "Galeri yalnızca görsellerden oluşabilir.",
  [PUBLISHING_ERROR.SELECTED_SCOPE_PRIMARY_REQUIRED]:
    "A primary category in your assigned scope is required.",
  [PUBLISHING_ERROR.INVALID_REVIEW_NOTE]:
    "Provide a plain-text review note between 3 and 4000 characters.",
  [PUBLISHING_ERROR.CONTENT_BODY_CORRUPT]:
    "Stored article body could not be compared.",
  [HOMEPAGE_BUILDER_ERROR.WRITE_CONFLICT]:
    "The homepage draft was updated elsewhere. Reload and try again.",
  [HOMEPAGE_BUILDER_ERROR.DUPLICATE_CONTENT_ITEM]:
    "The same story cannot occupy multiple homepage slots.",
  [HOMEPAGE_BUILDER_ERROR.INVALID_CONTENT_ITEM]:
    "The selected content item was not found.",
  [HOMEPAGE_BUILDER_ERROR.INVALID_VIDEO_ASSET]:
    "The selected video asset was not found.",
  [HOMEPAGE_BUILDER_ERROR.PUBLISH_VALIDATION_FAILED]:
    "The homepage draft cannot be published until all assignments are publicly eligible.",
  [CONVERSATION_ERROR.ITEM_NOT_FOUND]: "Konuşulan başlık bulunamadı.",
  [CONVERSATION_ERROR.INVALID_LABEL]: "Başlık 1-80 karakter olmalı.",
  [CONVERSATION_ERROR.INVALID_REASON]: "Bağlam metni en fazla 200 karakter olmalı.",
  [CONVERSATION_ERROR.LIMIT_EXCEEDED]: "En fazla 5 başlık eklenebilir.",
  [CONVERSATION_ERROR.INVALID_REORDER]: "Sıralama isteği geçersiz.",
  [MEDIA_RIGHTS_ERROR.MEDIA_NOT_FOUND]: "Medya bulunamadı.",
  [MEDIA_RIGHTS_ERROR.INVALID_RIGHTS]: "Hak bilgileri geçersiz.",
  [MEDIA_UPLOAD_ERROR.EMPTY_FILE]: "Yüklenecek dosya boş.",
  [MEDIA_UPLOAD_ERROR.FILE_TOO_LARGE]: "Dosya boyutu izin verilen sınırı aşıyor.",
  [MEDIA_UPLOAD_ERROR.UNSUPPORTED_FORMAT]: "Bu görsel biçimi desteklenmiyor.",
  [MEDIA_UPLOAD_ERROR.INVALID_IMAGE]: "Dosya geçerli bir görsel değil.",
  [MEDIA_UPLOAD_ERROR.DIMENSIONS_EXCEEDED]: "Görsel boyutları izin verilen sınırı aşıyor.",
  [MEDIA_UPLOAD_ERROR.STORAGE_FAILED]: "Görsel kaydedilemedi.",
  [MEDIA_UPLOAD_ERROR.STORAGE_NOT_CONFIGURED]: "Medya depolama yapılandırılmadı.",
  [MEDIA_UPLOAD_ERROR.INVALID_UPLOAD]: "Yükleme isteği geçersiz.",
  [PUBLISHING_ERROR.CONTENT_LEGAL_HOLD]:
    "Legal hold aktif: bu işlem şu anda engellendi.",
  [PUBLISHING_ERROR.CONTENT_LEGALLY_WITHDRAWN]:
    "Bu içerik yasal geri çekme veya kaldırma nedeniyle düzenlenemez.",
  [VIDEO_ERROR.NOT_FOUND]: "Video bulunamadı.",
  [VIDEO_ERROR.UNSUPPORTED_PROVIDER]:
    "Şu anda yalnızca YouTube ve Vimeo destekleniyor.",
  [VIDEO_ERROR.INVALID_VIDEO_URL]: "Video bağlantısı geçersiz.",
  [VIDEO_ERROR.INVALID_PROVIDER_ID]: "Video kimliği geçersiz.",
  [VIDEO_ERROR.DUPLICATE_VIDEO]: "Bu video zaten kayıtlı.",
  [VIDEO_ERROR.INVALID_POSTER]: "Video posteri yalnızca görsel medya olabilir.",
  [VIDEO_ERROR.INVALID_METADATA]: "Video alanları geçersiz.",
  [VIDEO_ERROR.STALE_WRITE]:
    "Bu video başka bir oturumda güncellendi. Yenileyip tekrar deneyin.",
  [CONTENT_LEGAL_ERROR.NOT_PUBLISHED]:
    "Bu işlem yalnızca yayın geçmişi olan içeriklerde uygulanabilir.",
  [CONTENT_LEGAL_ERROR.ALREADY_RETRACTED]: "Bu haber zaten geri çekilmiş.",
  [CONTENT_LEGAL_ERROR.ALREADY_TAKEN_DOWN]:
    "Bu içerik zaten hukuki olarak kaldırılmış.",
  [CONTENT_LEGAL_ERROR.LEGAL_HOLD_ALREADY_ACTIVE]: "Legal hold zaten aktif.",
  [CONTENT_LEGAL_ERROR.LEGAL_HOLD_NOT_ACTIVE]: "Aktif bir legal hold yok.",
  [CONTENT_LEGAL_ERROR.INVALID_NOTE]: "İç not veya kamu notu geçersiz.",
  [CONTENT_LEGAL_ERROR.INVALID_LEGAL_ACTION]: "Yasal işlem isteği geçersiz.",
  [STAFF_ADMIN_HTTP_ERROR.STAFF_NOT_FOUND]: "Staff account was not found.",
  [STAFF_ADMIN_HTTP_ERROR.STAFF_WRITE_CONFLICT]:
    "This staff account was updated elsewhere. Reload and try again.",
  [STAFF_ADMIN_HTTP_ERROR.LAST_SUPER_ADMIN]:
    "The last active Super Admin cannot be removed or disabled.",
  [STAFF_ADMIN_HTTP_ERROR.INVALID_STAFF_ROLE]: "The requested staff role is invalid.",
  [STAFF_ADMIN_HTTP_ERROR.INVALID_STAFF_SCOPE]:
    "The requested category scope is invalid.",
  [STAFF_ADMIN_HTTP_ERROR.INVALID_ACCOUNT_TRANSITION]:
    "The requested account status is invalid.",
  [STAFF_ADMIN_HTTP_ERROR.SESSION_NOT_FOUND]: "Staff session was not found.",
  [STAFF_ADMIN_HTTP_ERROR.MFA_NOT_ENROLLED]:
    "This staff account has no MFA factor to disable.",
  [ENTITY_ERROR.ENTITY_NOT_FOUND]: "Varlık kaydı bulunamadı.",
  [ENTITY_ERROR.ENTITY_WRITE_CONFLICT]:
    "Bu kayıt başka bir kullanıcı tarafından güncellendi. Son sürümü yükleyip değişikliklerinizi yeniden kontrol edin.",
  [ENTITY_ERROR.INVALID_NAME]: "Ad geçersiz.",
  [ENTITY_ERROR.INVALID_ALIAS]: "Takma ad geçersiz.",
  [ENTITY_ERROR.DUPLICATE_ALIAS]: "Aynı takma ad bu varlıkta zaten var.",
  [ENTITY_ERROR.INVALID_MEDIA]: "Seçilen portre geçerli bir görsel olmalıdır.",
  [ENTITY_ERROR.INVALID_STATUS]: "Bu durum geçişi şu an için uygun değil.",
  [ENTITY_ERROR.INVALID_PROFILE]: "Profil bilgileri geçersiz.",
};

export function editorJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: EDITOR_NO_STORE_HEADERS,
  });
}

export function editorErrorResponse(
  status: number,
  code: string,
  message?: string,
): NextResponse {
  return editorJson(
    {
      ok: false,
      error: {
        code,
        message: message ?? SAFE_MESSAGES[code] ?? "The request could not be completed.",
      },
    },
    status,
  );
}

export function mapEditorError(error: unknown): NextResponse {
  if (error instanceof EditorHttpError) {
    return editorErrorResponse(error.status, error.code, error.message);
  }

  if (error instanceof PublishingError) {
    return editorErrorResponse(
      PUBLISHING_STATUS[error.code] ?? 400,
      error.code,
      SAFE_MESSAGES[error.code],
    );
  }

  if (error instanceof HomepageBuilderError) {
    return editorErrorResponse(
      HOMEPAGE_BUILDER_STATUS[error.code] ?? 400,
      error.code,
      SAFE_MESSAGES[error.code],
    );
  }

  if (error instanceof ConversationError) {
    return editorErrorResponse(
      CONVERSATION_STATUS[error.code] ?? 400,
      error.code,
      SAFE_MESSAGES[error.code],
    );
  }

  if (error instanceof MediaRightsError) {
    return editorErrorResponse(
      MEDIA_RIGHTS_STATUS_MAP[error.code] ?? 400,
      error.code,
      SAFE_MESSAGES[error.code],
    );
  }

  if (error instanceof MediaUploadError) {
    return editorErrorResponse(
      MEDIA_UPLOAD_STATUS_MAP[error.code] ?? 400,
      error.code,
      SAFE_MESSAGES[error.code],
    );
  }

  if (error instanceof VideoError) {
    return editorErrorResponse(
      VIDEO_STATUS_MAP[error.code] ?? 400,
      error.code,
      SAFE_MESSAGES[error.code],
    );
  }

  if (error instanceof ContentLegalError) {
    return editorErrorResponse(
      CONTENT_LEGAL_STATUS[error.code] ?? 400,
      error.code,
      SAFE_MESSAGES[error.code],
    );
  }

  if (error instanceof SeoInspectionError) {
    const message =
      error.code === SEO_INSPECTION_ERROR.CONTENT_NOT_FOUND
        ? "İçerik bulunamadı veya yetkinizin dışında."
        : "Bu SEO kaydını görüntüleme yetkiniz yok.";
    return editorErrorResponse(
      SEO_INSPECTION_STATUS[error.code] ?? 400,
      error.code,
      message,
    );
  }

  if (error instanceof StaffAdminError) {
    const code = STAFF_ADMIN_HTTP_CODE[error.code] ?? error.code;
    return editorErrorResponse(
      STAFF_ADMIN_STATUS[error.code] ?? 400,
      code,
      SAFE_MESSAGES[code],
    );
  }

  if (error instanceof StaffMfaError) {
    return editorErrorResponse(
      STAFF_MFA_STATUS[error.code] ?? 400,
      error.code,
      "The MFA request could not be completed.",
    );
  }

  if (error instanceof EntityError) {
    return editorErrorResponse(
      ENTITY_STATUS_MAP[error.code] ?? 400,
      error.code,
      SAFE_MESSAGES[error.code],
    );
  }

  if (error instanceof FeatureControlError) {
    const message =
      error.code === FEATURE_CONTROL_ERROR.WRITE_CONFLICT
        ? "Bu kontrol başka bir yönetici tarafından değiştirildi. Güncel durumu yeniden yükleyin."
        : error.code === FEATURE_CONTROL_ERROR.FORBIDDEN
          ? SAFE_MESSAGES[EDITOR_API_ERROR.FORBIDDEN]
          : "The request could not be completed.";
    return editorErrorResponse(
      FEATURE_CONTROL_STATUS[error.code] ?? 400,
      error.code,
      message,
    );
  }

  return editorErrorResponse(500, EDITOR_API_ERROR.INTERNAL_ERROR);
}

export async function readEditorJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > EDITOR_JSON_MAX_BYTES) {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.REQUEST_TOO_LARGE,
      SAFE_MESSAGES[EDITOR_API_ERROR.REQUEST_TOO_LARGE],
    );
  }

  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new EditorHttpError(
      400,
      EDITOR_API_ERROR.INVALID_JSON,
      SAFE_MESSAGES[EDITOR_API_ERROR.INVALID_JSON],
    );
  }
}

export function editorOk<T>(data: T, status = 200): NextResponse {
  return editorJson({ ok: true, data }, status);
}
