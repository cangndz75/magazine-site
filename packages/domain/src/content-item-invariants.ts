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

/**
 * Public readers must resolve the live version only when publicationStatus is
 * PUBLISHED. A preserved publishedVersionId on UNPUBLISHED is historical
 * identity, not a public pointer.
 */
export function publicPublishedVersionId(state: {
  publicationStatus: PublicationStatus;
  publishedVersionId: string | null;
  deletedAt?: Date | string | null;
}): string | null {
  if (state.deletedAt != null) {
    return null;
  }

  if (state.publicationStatus !== PUBLICATION_STATUS.PUBLISHED) {
    return null;
  }

  return state.publishedVersionId;
}
