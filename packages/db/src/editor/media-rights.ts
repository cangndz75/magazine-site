import { eq } from "drizzle-orm";
import {
  MEDIA_RIGHTS_ERROR,
  MediaRightsError,
  authorizeMediaRightsRead,
  authorizeMediaRightsWrite,
  canonicalizeMediaRightsWrite,
  type CanonicalMediaRights,
  type MediaPublicEligibility,
  type MediaRightsDecision,
  type MediaRightsWriteInput,
  type StaffRole,
} from "@magazine/domain";
import { getDb } from "../client";
import { media } from "../schema/media";
import {
  eligibilityForRow,
  rightsFromMediaRow,
} from "./media-projections";

export type EditorMediaRights = CanonicalMediaRights & {
  licenseNote: string | null;
};

export type EditorMediaDetail = {
  id: string;
  storageKey: string;
  mediaType: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  createdAt: Date;
  rights: EditorMediaRights;
  eligibility: MediaPublicEligibility;
};

function unwrapMediaRightsDecision<T>(decision: MediaRightsDecision<T>): T {
  if (!decision.ok) {
    throw new MediaRightsError(decision.code);
  }
  return decision.value;
}

function toEditorDetail(
  row: typeof media.$inferSelect,
  now: Date,
): EditorMediaDetail {
  const rights = rightsFromMediaRow(row);
  return {
    id: row.id,
    storageKey: row.storageKey,
    mediaType: row.mediaType,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    byteSize: row.byteSize,
    createdAt: row.createdAt,
    rights,
    eligibility: eligibilityForRow(row, now),
  };
}

export async function getEditorMediaDetail(input: {
  mediaId: string;
  roles: readonly StaffRole[];
  now?: Date;
}): Promise<EditorMediaDetail> {
  unwrapMediaRightsDecision(authorizeMediaRightsRead({ roles: input.roles }));
  const now = input.now ?? new Date();
  const db = getDb();
  const [row] = await db
    .select()
    .from(media)
    .where(eq(media.id, input.mediaId))
    .limit(1);
  if (!row) {
    throw new MediaRightsError(MEDIA_RIGHTS_ERROR.MEDIA_NOT_FOUND);
  }
  return toEditorDetail(row, now);
}

export async function updateMediaRights(input: {
  mediaId: string;
  roles: readonly StaffRole[];
  rights: MediaRightsWriteInput;
  now?: Date;
}): Promise<EditorMediaDetail> {
  unwrapMediaRightsDecision(authorizeMediaRightsWrite({ roles: input.roles }));
  const rights = unwrapMediaRightsDecision(canonicalizeMediaRightsWrite(input.rights));
  const now = input.now ?? new Date();
  const db = getDb();

  return db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: media.id })
      .from(media)
      .where(eq(media.id, input.mediaId))
      .for("update");
    if (!locked) {
      throw new MediaRightsError(MEDIA_RIGHTS_ERROR.MEDIA_NOT_FOUND);
    }

    const [updated] = await tx
      .update(media)
      .set({
        sourceKind: rights.sourceKind,
        sourceName: rights.sourceName,
        creatorName: rights.creatorName,
        rightsHolder: rights.rightsHolder,
        licenseType: rights.licenseType,
        licenseReference: rights.licenseReference,
        licenseNote: rights.licenseNote,
        licenseStartsAt: rights.licenseStartsAt,
        licenseExpiresAt: rights.licenseExpiresAt,
        creditLine: rights.creditLine,
        usageRestriction: rights.usageRestriction,
        territoryRestriction: rights.territoryRestriction,
      })
      .where(eq(media.id, input.mediaId))
      .returning();

    if (!updated) {
      throw new MediaRightsError(MEDIA_RIGHTS_ERROR.MEDIA_NOT_FOUND);
    }
    return toEditorDetail(updated, now);
  });
}
