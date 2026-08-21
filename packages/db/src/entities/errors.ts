import { ENTITY_ERROR, EntityError, type EntityDecision } from "@magazine/domain";

export function unwrapEntityDecision<T>(decision: EntityDecision<T>): T {
  if (!decision.ok) {
    throw new EntityError(decision.code);
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

export function rethrowEntityDbError(error: unknown): never {
  if (error instanceof EntityError) {
    throw error;
  }

  if (
    isPgError(error) &&
    error.code === "23505" &&
    (error.constraint === "entities_slug_key" ||
      error.constraint === "entity_slug_history_old_slug_key" ||
      error.constraint === "entity_slug_history_entity_old_slug_key")
  ) {
    throw new EntityError(ENTITY_ERROR.SLUG_CONFLICT);
  }

  if (
    isPgError(error) &&
    error.code === "23505" &&
    error.constraint === "entity_aliases_entity_normalized_key"
  ) {
    throw new EntityError(ENTITY_ERROR.DUPLICATE_ALIAS);
  }

  throw error;
}
