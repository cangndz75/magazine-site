import type {
  EditorSafeHeroThumbnail,
  NewsroomListReadinessInput,
} from "@magazine/domain";

export type NewsroomListRowInput = {
  publicationStatus: NewsroomListReadinessInput["publicationStatus"];
  displayVersion: {
    workflowStatus: NewsroomListReadinessInput["workflowStatus"];
  };
  primaryCategory: { id: string } | null;
  authors: readonly { id: string }[];
  legalHoldAt: string | null;
  retractedAt: string | null;
  takedownAt: string | null;
  changesRequestedNote: string | null;
  heroThumbnail: EditorSafeHeroThumbnail | null;
};

export function toNewsroomReadinessInput(
  row: NewsroomListRowInput,
): NewsroomListReadinessInput {
  return {
    publicationStatus: row.publicationStatus,
    workflowStatus: row.displayVersion.workflowStatus,
    hasPrimaryCategory: row.primaryCategory !== null,
    authorCount: row.authors.length,
    legalHoldAt: row.legalHoldAt,
    retractedAt: row.retractedAt,
    takedownAt: row.takedownAt,
    changesRequestedNote: row.changesRequestedNote,
    heroAssigned: row.heroThumbnail !== null,
    heroRightsEligible: null,
  };
}
