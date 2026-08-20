import { notFound } from "next/navigation";
import {
  CAPABILITY,
  PUBLISHING_ERROR,
  PublishingError,
  hasCapability,
  isUuid,
} from "@magazine/domain";
import {
  getArticleEditorModel,
  listContentReviewHistory,
  listContentRevisionHistory,
} from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import {
  editorScopeFromSession,
  loadAccessibleContent,
} from "@/lib/content/authorize";
import { parseArticleSearchParams } from "@/lib/content/article-page-params";
import { env } from "@/lib/env";
import { ArticleEditor } from "@/components/article-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "İçerik",
};

export default async function ArticleWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ contentItemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCapability(CAPABILITY.CONTENT_READ);
  const { contentItemId } = await params;

  if (!isUuid(contentItemId)) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const query = parseArticleSearchParams(resolvedSearchParams);

  if (query.versionIdInvalid) {
    notFound();
  }

  try {
    await loadAccessibleContent(session, contentItemId);
  } catch (error) {
    if (
      error instanceof PublishingError &&
      error.code === PUBLISHING_ERROR.CONTENT_NOT_FOUND
    ) {
      notFound();
    }
    throw error;
  }

  const scope = editorScopeFromSession(session);
  let model;
  let revisionHistory;
  let reviewHistory;

  try {
    [model, revisionHistory, reviewHistory] = await Promise.all([
      getArticleEditorModel(contentItemId, {
        focusVersionId: query.versionId,
        mediaPublicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
      }),
      listContentRevisionHistory(contentItemId, scope, { limit: 8 }),
      listContentReviewHistory(contentItemId, scope, {
        versionId: query.versionId,
      }),
    ]);
  } catch (error) {
    if (
      error instanceof PublishingError &&
      (error.code === PUBLISHING_ERROR.CONTENT_NOT_FOUND ||
        error.code === PUBLISHING_ERROR.VERSION_NOT_FOUND)
    ) {
      notFound();
    }
    throw error;
  }

  if (!model) {
    notFound();
  }

  return (
    <ArticleEditor
      model={{
        contentItem: {
          ...model.contentItem,
          scheduledAt: model.contentItem.scheduledAt?.toISOString() ?? null,
          publishedAt: model.contentItem.publishedAt?.toISOString() ?? null,
          publicDateModified:
            model.contentItem.publicDateModified?.toISOString() ?? null,
          updatedAt: model.contentItem.updatedAt.toISOString(),
          legalHoldAt: model.contentItem.legalHoldAt?.toISOString() ?? null,
          legalHoldReason: model.contentItem.legalHoldReason,
          retractedAt: model.contentItem.retractedAt?.toISOString() ?? null,
          takedownAt: model.contentItem.takedownAt?.toISOString() ?? null,
        },
        displayVersionId: model.displayVersionId,
        editableVersion: model.editableVersion
          ? {
              ...model.editableVersion,
              createdAt: model.editableVersion.createdAt.toISOString(),
              concurrencyToken:
                model.editableVersion.concurrencyToken.toISOString(),
              body: model.editableVersion.body,
            }
          : null,
        publishedVersion: model.publishedVersion,
        draftVersion: model.draftVersion,
        scheduledVersion: model.scheduledVersion,
      }}
      returnHref={query.returnHref}
      fromReview={query.fromReview}
      focusedVersionId={
        query.versionId ?? model.editableVersion?.id ?? model.displayVersionId
      }
      revisions={{
        versions: revisionHistory.versions.map((version) => ({
          id: version.id,
          versionNumber: version.versionNumber,
          workflowStatus: version.workflowStatus,
          title: version.title,
          createdAt: version.createdAt.toISOString(),
          isCurrentDraft: version.isCurrentDraft,
          isScheduledVersion: version.isScheduledVersion,
          isPublishedVersion: version.isPublishedVersion,
        })),
        nextCursor: revisionHistory.nextCursor,
      }}
      reviewEvents={reviewHistory.events.map((event) => ({
        id: event.id,
        contentVersionId: event.contentVersionId,
        eventType: event.eventType,
        actorDisplayName: event.actor.displayName,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
      }))}
      permissions={{
        canEdit: hasCapability(session.roles, CAPABILITY.CONTENT_EDIT),
        canReview: hasCapability(session.roles, CAPABILITY.CONTENT_REVIEW),
        canPublish: hasCapability(session.roles, CAPABILITY.CONTENT_PUBLISH),
        canLegal: hasCapability(session.roles, CAPABILITY.CONTENT_LEGAL),
      }}
    />
  );
}
