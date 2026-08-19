import { eq } from "drizzle-orm";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  type Credibility,
  type EditorStaffScope,
  PUBLISHING_ERROR,
  PublishingError,
  assertContentNotDeleted,
  assertDraftRelationInputs,
  assertOptionalHttpUrl,
  assertStructuredArticleBody,
  canonicalizeDraftTitle,
  decideLockedDraftSave,
  getPrimaryCategoryId,
  nextMonotonicUpdatedAt,
  optionalTrimmedText,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";
import { unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";
import { loadLockedDisplayCategories } from "./locked-scope";
import {
  assertRelatedRecordsExist,
  assertHeroMediaAssignable,
  loadVersionRelations,
  replaceVersionRelations,
  type ContentRelationInput,
} from "./relations";
import {
  appendContentAuditEvent,
  buildDraftUpdateChangeSet,
  staffAuditActor,
} from "./audit";

export type UpdateDraftContentInput = ContentRelationInput & {
  contentItemId: string;
  versionId: string;
  expectedUpdatedAt: Date | string;
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

export type UpdateDraftContentResult = {
  contentItemId: string;
  versionId: string;
  updatedAt: Date;
};

export async function updateDraftContent(
  input: UpdateDraftContentInput,
): Promise<UpdateDraftContentResult> {
  const title = unwrapPublishingDecision(canonicalizeDraftTitle(input.title));
  const body = unwrapPublishingDecision(assertStructuredArticleBody(input.body));
  const canonicalUrl = unwrapPublishingDecision(
    assertOptionalHttpUrl(optionalTrimmedText(input.canonicalUrl)),
  );
  const sourceUrl = unwrapPublishingDecision(
    assertOptionalHttpUrl(optionalTrimmedText(input.sourceUrl)),
  );
  unwrapPublishingDecision(assertDraftRelationInputs(input));

  const nextCategoryIds = (input.categories ?? []).map((item) => item.categoryId);
  const nextPrimaryCategoryId = getPrimaryCategoryId(input.categories ?? []);

  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, input.contentItemId);
    unwrapPublishingDecision(assertContentNotDeleted(item.deletedAt));

    const [version] = await tx
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.id, input.versionId))
      .limit(1);

    if (!version) {
      throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_FOUND);
    }

    if (version.contentItemId !== item.id) {
      throw new PublishingError(PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM);
    }

    const current = await loadLockedDisplayCategories(tx, item);
    unwrapPublishingDecision(
      decideLockedDraftSave({
        requestedVersionId: input.versionId,
        draftVersionId: item.draftVersionId,
        workflowStatus: version.workflowStatus,
        publishedVersionId: item.publishedVersionId,
        scheduledVersionId: item.scheduledVersionId,
        currentUpdatedAt: item.updatedAt,
        expectedUpdatedAt: input.expectedUpdatedAt,
        scope: input.scope,
        currentPrimaryCategoryId: current.primaryCategoryId,
        nextCategoryIds,
        nextPrimaryCategoryId,
      }),
    );

    const beforeRelations = await loadVersionRelations(tx, version.id);
    const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt);
    const afterVersion = {
      ...version,
      title,
      subtitle: optionalTrimmedText(input.subtitle),
      excerpt: optionalTrimmedText(input.excerpt),
      seoTitle: optionalTrimmedText(input.seoTitle),
      seoDescription: optionalTrimmedText(input.seoDescription),
      canonicalUrl,
      robots: optionalTrimmedText(input.robots),
      credibility: input.credibility ?? null,
      credibilitySource: optionalTrimmedText(input.credibilitySource),
      source: optionalTrimmedText(input.source),
      sourceOrganization: optionalTrimmedText(input.sourceOrganization),
      sourceUrl,
      syndicated: input.syndicated ?? false,
      isMaterialUpdate: input.isMaterialUpdate ?? false,
    };
    const changeSet = buildDraftUpdateChangeSet({
      before: version,
      after: afterVersion,
      bodyChanged: JSON.stringify(version.body) !== JSON.stringify(body),
      beforeRelations,
      afterRelations: input,
    });

    await assertRelatedRecordsExist(tx, input);
    await assertHeroMediaAssignable(tx, input);
    await replaceVersionRelations(tx, version.id, input);

    await tx
      .update(contentVersions)
      .set({
        title: afterVersion.title,
        subtitle: afterVersion.subtitle,
        excerpt: afterVersion.excerpt,
        body,
        seoTitle: afterVersion.seoTitle,
        seoDescription: afterVersion.seoDescription,
        canonicalUrl: afterVersion.canonicalUrl,
        robots: afterVersion.robots,
        credibility: afterVersion.credibility,
        credibilitySource: afterVersion.credibilitySource,
        source: afterVersion.source,
        sourceOrganization: afterVersion.sourceOrganization,
        sourceUrl: afterVersion.sourceUrl,
        syndicated: afterVersion.syndicated,
        isMaterialUpdate: afterVersion.isMaterialUpdate,
      })
      .where(eq(contentVersions.id, version.id));

    await tx
      .update(contentItems)
      .set({
        updatedAt: nextUpdatedAt,
      })
      .where(eq(contentItems.id, item.id));

    if (changeSet) {
      await appendContentAuditEvent(tx, {
        contentItemId: item.id,
        versionId: version.id,
        eventType: CONTENT_AUDIT_EVENT_TYPE.DRAFT_UPDATED,
        actor: staffAuditActor(input.actorId),
        changeSet,
      });
    }

    return {
      contentItemId: item.id,
      versionId: version.id,
      updatedAt: nextUpdatedAt,
    };
  });
}
