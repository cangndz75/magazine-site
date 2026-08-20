import { eq } from "drizzle-orm";
import {
  CONTENT_AUDIT_EVENT_TYPE,
  type Credibility,
  type EditorStaffScope,
  PUBLISHING_ERROR,
  PublishingError,
  assertOptionalHttpUrl,
  assertStructuredArticleBody,
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
import { assertLockedEditorialMutationAllowed } from "./legal-hold-guard";
import {
  appendContentAuditEvent,
  buildDraftUpdateChangeSet,
  staffAuditActor,
} from "./audit";

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
  body?: unknown;
  title: string;
  scope: EditorStaffScope;
  actorId: string;
};

export type UpdateDraftScalarFieldsResult = {
  contentItemId: string;
  versionId: string;
  updatedAt: Date;
  fields: DraftScalarFields;
  body: Record<string, unknown> | unknown[];
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
  const body =
    input.body === undefined
      ? undefined
      : unwrapPublishingDecision(assertStructuredArticleBody(input.body));

  const db = getDb();

  return db.transaction(async (tx) => {
    const item = await lockContentItem(tx, input.contentItemId);
    assertLockedEditorialMutationAllowed(item);

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
    const changeSet = buildDraftUpdateChangeSet({
      before: version,
      after: fields,
      bodyChanged:
        body === undefined
          ? false
          : JSON.stringify(version.body) !== JSON.stringify(body),
    });

    await tx
      .update(contentVersions)
      .set(body === undefined ? fields : { ...fields, body })
      .where(eq(contentVersions.id, version.id));

    await tx
      .update(contentItems)
      .set({ updatedAt: nextUpdatedAt })
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
      fields,
      body: (body ?? version.body) as Record<string, unknown> | unknown[],
    };
  });
}
