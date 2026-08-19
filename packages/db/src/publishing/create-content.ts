import { eq } from "drizzle-orm";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  PUBLICATION_STATUS,
  WORKFLOW_STATUS,
  assertDraftRelationInputs,
  assertSelectedCreatePrimaryCategory,
  assertCategoriesAssignableInScope,
  canonicalizeContentSlug,
  getPrimaryCategoryId,
  type Credibility,
  type EditorStaffScope,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";
import { rethrowPublishingDbError, unwrapPublishingDecision } from "./errors";
import {
  assertRelatedRecordsExist,
  assertGalleryMediaAssignable,
  assertHeroMediaAssignable,
  insertVersionRelations,
  type ContentRelationInput,
} from "./relations";
import { appendContentAuditEvent, staffAuditActor } from "./audit";

export type CreateContentInput = ContentRelationInput & {
  slug: string;
  title: string;
  body: unknown;
  subtitle?: string | null;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  robots?: string | null;
  credibility?: Credibility | null;
  credibilitySource?: string | null;
  source?: string | null;
  sourceOrganization?: string | null;
  sourceUrl?: string | null;
  syndicated?: boolean;
  isMaterialUpdate?: boolean;
  scope: EditorStaffScope;
  actorId: string;
};

export type CreateContentResult = {
  contentItemId: string;
  versionId: string;
  slug: string;
  publicationStatus: typeof PUBLICATION_STATUS.NEVER_PUBLISHED;
  workflowStatus: typeof WORKFLOW_STATUS.DRAFT;
  draftVersionId: string;
  scheduleGeneration: 0;
  updatedAt: Date;
};

export async function createContent(
  input: CreateContentInput,
): Promise<CreateContentResult> {
  const slug = unwrapPublishingDecision(canonicalizeContentSlug(input.slug));
  unwrapPublishingDecision(assertDraftRelationInputs(input));

  const db = getDb();
  const now = new Date();

  try {
    return await db.transaction(async (tx) => {
      const nextPrimaryCategoryId = getPrimaryCategoryId(input.categories ?? []);
      unwrapPublishingDecision(
        assertSelectedCreatePrimaryCategory({
          ...input.scope,
          primaryCategoryId: nextPrimaryCategoryId,
        }),
      );
      unwrapPublishingDecision(
        assertCategoriesAssignableInScope({
          ...input.scope,
          categoryIds: (input.categories ?? []).map((item) => item.categoryId),
        }),
      );
      await assertRelatedRecordsExist(tx, input);
      await assertHeroMediaAssignable(tx, input);
      await assertGalleryMediaAssignable(tx, input);

      const [item] = await tx
        .insert(contentItems)
        .values({
          slug,
          publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
          publishedVersionId: null,
          draftVersionId: null,
          scheduledVersionId: null,
          scheduledAt: null,
          scheduleGeneration: 0,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: contentItems.id });

      if (!item) {
        throw new Error("Failed to create content item.");
      }

      const [version] = await tx
        .insert(contentVersions)
        .values({
          contentItemId: item.id,
          versionNumber: 1,
          workflowStatus: WORKFLOW_STATUS.DRAFT,
          title: input.title,
          subtitle: input.subtitle ?? null,
          excerpt: input.excerpt ?? null,
          body: input.body,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          canonicalUrl: input.canonicalUrl ?? null,
          robots: input.robots ?? null,
          credibility: input.credibility ?? null,
          credibilitySource: input.credibilitySource ?? null,
          source: input.source ?? null,
          sourceOrganization: input.sourceOrganization ?? null,
          sourceUrl: input.sourceUrl ?? null,
          syndicated: input.syndicated ?? false,
          isMaterialUpdate: input.isMaterialUpdate ?? false,
          createdAt: now,
        })
        .returning({ id: contentVersions.id });

      if (!version) {
        throw new Error("Failed to create content version.");
      }

      await insertVersionRelations(tx, version.id, input);

      await tx
        .update(contentItems)
        .set({
          draftVersionId: version.id,
          updatedAt: now,
        })
        .where(eq(contentItems.id, item.id));

      await appendContentAuditEvent(tx, {
        contentItemId: item.id,
        versionId: version.id,
        eventType: CONTENT_AUDIT_EVENT_TYPE.CONTENT_CREATED,
        actor: staffAuditActor(input.actorId),
      });

      return {
        contentItemId: item.id,
        versionId: version.id,
        slug,
        publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
        workflowStatus: WORKFLOW_STATUS.DRAFT,
        draftVersionId: version.id,
        scheduleGeneration: 0,
        updatedAt: now,
      };
    });
  } catch (error) {
    rethrowPublishingDbError(error);
  }
}
