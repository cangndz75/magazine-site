import { isBearerMachineAuthorized } from "@magazine/domain";

export const PUBLIC_CACHE_INVALIDATION_ERROR = {
  UNAUTHORIZED: "UNAUTHORIZED",
  INVALID_REQUEST: "INVALID_REQUEST",
} as const;

export class PublicCacheInvalidationError extends Error {
  readonly code: (typeof PUBLIC_CACHE_INVALIDATION_ERROR)[keyof typeof PUBLIC_CACHE_INVALIDATION_ERROR];
  readonly status: 400 | 401;

  constructor(
    code: (typeof PUBLIC_CACHE_INVALIDATION_ERROR)[keyof typeof PUBLIC_CACHE_INVALIDATION_ERROR],
    status: 400 | 401,
  ) {
    super(code);
    this.name = "PublicCacheInvalidationError";
    this.code = code;
    this.status = status;
  }
}

export function assertPublicCacheInvalidationAuthorized(
  request: Pick<Request, "headers">,
  expectedSecret: string,
): void {
  if (
    !isBearerMachineAuthorized(
      request.headers.get("authorization"),
      expectedSecret,
    )
  ) {
    throw new PublicCacheInvalidationError(
      PUBLIC_CACHE_INVALIDATION_ERROR.UNAUTHORIZED,
      401,
    );
  }
}
