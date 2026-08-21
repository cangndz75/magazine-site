import { and, eq, ne, sql } from "drizzle-orm";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  PUBLISHING_ERROR,
  PublishingError,
  decideChangeContentSlug,
  nextMonotonicUpdatedAt,
  slugAdvisoryLockKeys,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import { enqueuePublicArticleCacheInvalidation } from "../public-cache-outbox";
import { contentItems } from "../schema/content";
import { contentSlugHistory } from "../schema/slug-history";
import { rethrowPublishingDbError, unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";
import { authorizeLockedEditorMutation } from "./locked-scope";
import { assertLockedEditorialMutationAllowed } from "./legal-hold-guard";
import { appendContentAuditEvent, staffAuditActor } from "./audit";

export type UpdateContentSlugInput = {
  contentItemId: string;
  nextSlug: string;
  expectedUpdatedAt: Date | string;
  scope: EditorStaffScope;
  actorId: string;
};

export type UpdateContentSlugResult = {
  contentItemId: string;
  previousSlug: string;
  slug: string;
  updatedAt: Date;
  unchanged: boolean;
};

export async function updateContentSlug(
  input: UpdateContentSlugInput,
): Promise<UpdateContentSlugResult> {
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      const item = await lockContentItem(tx, input.contentItemId);
      assertLockedEditorialMutationAllowed(item);
      await authorizeLockedEditorMutation(tx, item, input.scope);

      const plan = unwrapPublishingDecision(
        decideChangeContentSlug({
          requestedSlug: input.nextSlug,
          currentSlug: item.slug,
          currentUpdatedAt: item.updatedAt,
          expectedUpdatedAt: input.expectedUpdatedAt,
          deletedAt: item.deletedAt,
          legalHoldAt: item.legalHoldAt,
        }),
      );

      if (plan.unchanged) {
        return {
          contentItemId: item.id,
          previousSlug: plan.previousSlug,
          slug: plan.nextSlug,
          updatedAt: item.updatedAt,
          unchanged: true,
        };
      }

      for (const slug of slugAdvisoryLockKeys(plan.previousSlug, plan.nextSlug)) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${slug}))`);
      }

      const [currentOwner] = await tx
        .select({ id: contentItems.id })
        .from(contentItems)
        .where(
          and(eq(contentItems.slug, plan.nextSlug), ne(contentItems.id, item.id)),
        )
        .limit(1);
      if (currentOwner) {
        throw new PublishingError(PUBLISHING_ERROR.SLUG_CONFLICT);
      }

      const [historyOwner] = await tx
        .select({ contentItemId: contentSlugHistory.contentItemId })
        .from(contentSlugHistory)
        .where(
          and(
            eq(contentSlugHistory.oldSlug, plan.nextSlug),
            ne(contentSlugHistory.contentItemId, item.id),
          ),
        )
        .limit(1);
      if (historyOwner) {
        throw new PublishingError(PUBLISHING_ERROR.SLUG_CONFLICT);
      }

      const [existingHistory] = await tx
        .select({ id: contentSlugHistory.id })
        .from(contentSlugHistory)
        .where(
          and(
            eq(contentSlugHistory.contentItemId, item.id),
            eq(contentSlugHistory.oldSlug, plan.previousSlug),
          ),
        )
        .limit(1);
      if (!existingHistory) {
        await tx.insert(contentSlugHistory).values({
          contentItemId: item.id,
          oldSlug: plan.previousSlug,
          actorStaffUserId: input.actorId,
        });
      }

      const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt);
      await tx
        .update(contentItems)
        .set({
          slug: plan.nextSlug,
          updatedAt: nextUpdatedAt,
        })
        .where(eq(contentItems.id, item.id));

      await appendContentAuditEvent(tx, {
        contentItemId: item.id,
        versionId: item.draftVersionId ?? item.publishedVersionId,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_SLUG_CHANGED,
        actor: staffAuditActor(input.actorId),
        changeSet: {
          slugChange: {
            before: plan.previousSlug,
            after: plan.nextSlug,
          },
        },
      });

      const historyRows = await tx
        .select({ oldSlug: contentSlugHistory.oldSlug })
        .from(contentSlugHistory)
        .where(eq(contentSlugHistory.contentItemId, item.id));
      const slugsToInvalidate = new Set<string>([
        plan.previousSlug,
        plan.nextSlug,
        ...historyRows.map((row) => row.oldSlug),
      ]);
      for (const slug of slugsToInvalidate) {
        await enqueuePublicArticleCacheInvalidation(tx, {
          contentItemId: item.id,
          slug,
        });
      }

      return {
        contentItemId: item.id,
        previousSlug: plan.previousSlug,
        slug: plan.nextSlug,
        updatedAt: nextUpdatedAt,
        unchanged: false,
      };
    });
  } catch (error) {
    rethrowPublishingDbError(error);
  }
}
