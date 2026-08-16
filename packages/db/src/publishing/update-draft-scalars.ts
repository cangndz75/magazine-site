import { eq } from "drizzle-orm";
import {
  type Credibility,
  type EditorStaffScope,
  PUBLISHING_ERROR,
  PublishingError,
  assertContentNotDeleted,
  assertOptionalHttpUrl,
  canonicalizeDraftTitle,
  decideSaveDraft,
  nextMonotonicUpdatedAt,
  optionalTrimmedText,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems, contentVersions } from "../schema/content";
import { unwrapPublishingDecision } from "./errors";
import { lockContentItem } from "./lock";
import { authorizeLockedEditorMutation } from "./locked-scope";

export type DraftScalarFields = {
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  credibility: Credibility | null;
  credibilitySource: string | null;
  source: string | null;
  sourceOrganization: string | null;
  sourceUrl: string | null;
  syndicated: boolean;
  isMaterialUpdate: boolean;
};

export type UpdateDraftScalarFieldsInput = Partial<DraftScalarFields> & {
  contentItemId: string;
  versionId: string;
  expectedUpdatedAt: Date | string;
  title: string;
  scope: EditorStaffScope;
};

export type UpdateDraftScalarFieldsResult = {
  contentItemId: string;
  versionId: string;
  updatedAt: Date;
  fields: DraftScalarFields;
};

export async function updateDraftScalarFields(
  input: UpdateDraftScalarFieldsInput,
): Promise<UpdateDraftScalarFieldsResult> {
  const fields: DraftScalarFields = {
    title: unwrapPublishingDecision(canonicalizeDraftTitle(input.title)),
    subtitle: optionalTrimmedText(input.subtitle),
    excerpt: optionalTrimmedText(input.excerpt),
    seoTitle: optionalTrimmedText(input.seoTitle),
    seoDescription: optionalTrimmedText(input.seoDescription),
    canonicalUrl: unwrapPublishingDecision(
      assertOptionalHttpUrl(optionalTrimmedText(input.canonicalUrl)),
    ),
    robots: optionalTrimmedText(input.robots),
    credibility: input.credibility ?? null,
    credibilitySource: optionalTrimmedText(input.credibilitySource),
    source: optionalTrimmedText(input.source),
    sourceOrganization: optionalTrimmedText(input.sourceOrganization),
    sourceUrl: unwrapPublishingDecision(
      assertOptionalHttpUrl(optionalTrimmedText(input.sourceUrl)),
    ),
    syndicated: input.syndicated ?? false,
    isMaterialUpdate: input.isMaterialUpdate ?? false,
  };

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

    await authorizeLockedEditorMutation(tx, item, input.scope);

    unwrapPublishingDecision(
      decideSaveDraft({
        requestedVersionId: input.versionId,
        draftVersionId: item.draftVersionId,
        workflowStatus: version.workflowStatus,
        publishedVersionId: item.publishedVersionId,
        scheduledVersionId: item.scheduledVersionId,
        currentUpdatedAt: item.updatedAt,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    );

    const nextUpdatedAt = nextMonotonicUpdatedAt(item.updatedAt);

    await tx
      .update(contentVersions)
      .set(fields)
      .where(eq(contentVersions.id, version.id));

    await tx
      .update(contentItems)
      .set({ updatedAt: nextUpdatedAt })
      .where(eq(contentItems.id, item.id));

    return {
      contentItemId: item.id,
      versionId: version.id,
      updatedAt: nextUpdatedAt,
      fields,
    };
  });
}
