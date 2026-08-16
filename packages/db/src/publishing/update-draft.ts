import { eq } from "drizzle-orm";
import {
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
  replaceVersionRelations,
  type ContentRelationInput,
} from "./relations";

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

    const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt);

    await assertRelatedRecordsExist(tx, input);
    await replaceVersionRelations(tx, version.id, input);

    await tx
      .update(contentVersions)
      .set({
        title,
        subtitle: optionalTrimmedText(input.subtitle),
        excerpt: optionalTrimmedText(input.excerpt),
        body,
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
      })
      .where(eq(contentVersions.id, version.id));

    await tx
      .update(contentItems)
      .set({
        updatedAt: nextUpdatedAt,
      })
      .where(eq(contentItems.id, item.id));

    return {
      contentItemId: item.id,
      versionId: version.id,
      updatedAt: nextUpdatedAt,
    };
  });
}
