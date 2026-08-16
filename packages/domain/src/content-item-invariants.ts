import {
  PUBLICATION_STATUS,
  type PublicationStatus,
} from "./publication-status";

export type VersionPointers = {
  publishedVersionId: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
};

function areDistinctWhenBothPresent(
  left: string | null,
  right: string | null,
): boolean {
  return left === null || right === null || left !== right;
}

export function versionPointersAreSeparated(
  pointers: VersionPointers,
): boolean {
  return (
    areDistinctWhenBothPresent(
      pointers.publishedVersionId,
      pointers.draftVersionId,
    ) &&
    areDistinctWhenBothPresent(
      pointers.publishedVersionId,
      pointers.scheduledVersionId,
    ) &&
    areDistinctWhenBothPresent(
      pointers.draftVersionId,
      pointers.scheduledVersionId,
    )
  );
}

export type PublishedState = {
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  publishedAt: Date | string | null;
};

export function publishedStateIsCoherent(state: PublishedState): boolean {
  if (state.publicationStatus !== PUBLICATION_STATUS.PUBLISHED) {
    return true;
  }

  return state.publishedVersionId !== null && state.publishedAt !== null;
}
