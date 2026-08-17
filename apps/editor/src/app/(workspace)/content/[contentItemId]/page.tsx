import { notFound } from "next/navigation";
import {
  CAPABILITY,
  PUBLISHING_ERROR,
  PublishingError,
  isUuid,
  safeInternalPath,
} from "@magazine/domain";
import { getArticleEditorModel } from "@magazine/db/editor";
import { requireCapability } from "@/lib/auth/authorization";
import { loadAccessibleContent } from "@/lib/content/authorize";
import { ArticleEditor } from "@/components/article-editor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "İçerik düzenle",
};

export default async function ArticleEditorPage({
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

  const model = await getArticleEditorModel(contentItemId);

  if (!model) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const rawReturnTo = resolvedSearchParams.returnTo;
  const returnHref = safeInternalPath(
    typeof rawReturnTo === "string" ? rawReturnTo : null,
  );

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
      returnHref={returnHref}
    />
  );
}
