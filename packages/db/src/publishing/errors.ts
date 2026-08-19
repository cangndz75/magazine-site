import {
  PUBLISHING_ERROR,
  PublishingError,
  type PublishingDecision,
} from "@magazine/domain";

export function unwrapPublishingDecision<T>(
  decision: PublishingDecision<T>,
): T {
  if (!decision.ok) {
    throw new PublishingError(decision.code);
  }

  return decision.value;
}

function isPgError(
  error: unknown,
): error is { code: string; constraint?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  );
}

export function rethrowPublishingDbError(error: unknown): never {
  if (error instanceof PublishingError) {
    throw error;
  }

  if (
    isPgError(error) &&
    error.code === "23505" &&
    error.constraint === "content_items_slug_key"
  ) {
    throw new PublishingError(PUBLISHING_ERROR.SLUG_CONFLICT);
  }

  if (
    isPgError(error) &&
    error.code === "23505" &&
    error.constraint === "content_versions_one_in_review"
  ) {
    throw new PublishingError(PUBLISHING_ERROR.INVALID_WORKFLOW_TRANSITION);
  }

  if (
    isPgError(error) &&
    error.code === "23514" &&
    error.constraint === "content_review_events_note_bounds"
  ) {
    throw new PublishingError(PUBLISHING_ERROR.INVALID_REVIEW_NOTE);
  }

  throw error;
}
