import { desc, eq } from "drizzle-orm";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  type EditorStaffScope,
  PUBLISHING_ERROR,
  PublishingError,
  WORKFLOW_STATUS,
  assertContentNotDeleted,
  copyVersionOwnedRelations,
  nextMonotonicUpdatedAt,
  nextVersionNumber,
  resolveDraftRevisionSource,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";
import { unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";
import { authorizeLockedEditorMutation } from "./locked-scope";
import {
  insertVersionRelations,
  loadVersionRelations,
} from "./relations";
import {
  insertVersionVideoRelations,
  loadVersionVideoRelations,
} from "./draft-video";
import { appendContentAuditEvent, staffAuditActor } from "./audit";

export type CreateDraftRevisionResult = {
  contentItemId: string;
  sourceVersionId: string;
  versionId: string;
  versionNumber: number;
  draftVersionId: string;
  updatedAt: Date;
};

/**
 * Creates a new DRAFT version.
 *
 * Source selection:
 * - If a draft already exists, fails with DRAFT_ALREADY_EXISTS.
 * - If sourceVersionId is provided, copies that version (must belong to the item).
 * - Otherwise copies publishedVersionId.
 * - A scheduled-only item (no publishedVersionId) is not an implicit source;
 *   pass sourceVersionId explicitly.
 *
 * Never mutates the source (published/scheduled/previous) version row.
 * Version numbers are allocated after locking the ContentItem row.
 */
export async function createDraftRevision(
  contentItemId: string,
  sourceVersionId: string | undefined,
  scope: EditorStaffScope,
  actorId: string,
): Promise<CreateDraftRevisionResult> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, contentItemId);
    unwrapPublishingDecision(assertContentNotDeleted(item.deletedAt));
    await authorizeLockedEditorMutation(tx, item, scope);

    const sourceId = unwrapPublishingDecision(
      resolveDraftRevisionSource({
        sourceVersionId,
        draftVersionId: item.draftVersionId,
        publishedVersionId: item.publishedVersionId,
      }),
    );

    const [source] = await tx
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.id, sourceId))
      .limit(1);

    if (!source) {
      throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_FOUND);
    }

    if (source.contentItemId !== item.id) {
      throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM);
    }

    const [latest] = await tx
      .select({ versionNumber: contentVersions.versionNumber })
      .from(contentVersions)
      .where(eq(contentVersions.contentItemId, item.id))
      .orderBy(desc(contentVersions.versionNumber))
      .limit(1);

    const versionNumber = nextVersionNumber(latest?.versionNumber ?? 0);
    const loaded = await loadVersionRelations(tx, source.id);
    const relations = copyVersionOwnedRelations({
      categories: loaded.categories ?? [],
      tags: loaded.tags ?? [],
      entities: loaded.entities ?? [],
      media: loaded.media ?? [],
      authors: loaded.authors ?? [],
    });
    const videoRelations = (await loadVersionVideoRelations(tx, source.id)).map(
      (item) => ({ ...item }),
    );

    const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt);

    const [created] = await tx
      .insert(contentVersions)
      .values({
        contentItemId: item.id,
        versionNumber,
        workflowStatus: WORKFLOW_STATUS.DRAFT,
        title: source.title,
        subtitle: source.subtitle,
        excerpt: source.excerpt,
        body: source.body,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        canonicalUrl: source.canonicalUrl,
        robots: source.robots,
        credibility: source.credibility,
        credibilitySource: source.credibilitySource,
        source: source.source,
        sourceOrganization: source.sourceOrganization,
        sourceUrl: source.sourceUrl,
        syndicated: source.syndicated,
        isMaterialUpdate: source.isMaterialUpdate,
        createdAt: nextUpdatedAt,
      })
      .returning({ id: contentVersions.id });

    if (!created) {
      throw new Error("Failed to create draft revision.");
    }

    await insertVersionRelations(tx, created.id, relations);
    await insertVersionVideoRelations(tx, created.id, videoRelations);

    await tx
      .update(contentItems)
      .set({
        draftVersionId: created.id,
        updatedAt: nextUpdatedAt,
      })
      .where(eq(contentItems.id, item.id));

    await appendContentAuditEvent(tx, {
      contentItemId: item.id,
      versionId: created.id,
      eventType: CONTENT_AUDIT_EVENT_TYPE.DRAFT_REVISION_CREATED,
      actor: staffAuditActor(actorId),
    });

    return {
      contentItemId: item.id,
      sourceVersionId: source.id,
      versionId: created.id,
      versionNumber,
      draftVersionId: created.id,
      updatedAt: nextUpdatedAt,
    };
  });
}
