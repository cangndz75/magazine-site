import {
  canAccessEditorContentByPrimaryCategory,
  scopedCategoryIdsForQuery,
  PUBLISHING_ERROR,
  PublishingError,
} from "@magazine/domain";
import {
  getEditorContentAccess,
  type EditorContentAccess,
} from "@magazine/db/editor";
import type { StaffSessionContext } from "@/lib/auth/session";

export function editorScopeFromSession(session: StaffSessionContext) {
  return {
    roles: session.roles,
    scopeMode: session.scopeMode,
    scopedCategoryIds: session.scopedCategoryIds,
  };
}

export function queryScopeFromSession(session: StaffSessionContext) {
  return {
    scopedCategoryIds: scopedCategoryIdsForQuery(editorScopeFromSession(session)),
  };
}

export async function loadAccessibleContent(
  session: StaffSessionContext,
  contentItemId: string,
): Promise<EditorContentAccess> {
  const access = await getEditorContentAccess(contentItemId);
  if (!access) {
    throw new PublishingError(PUBLISHING_ERROR.CONTENT_NOT_FOUND);
  }

  if (
    !canAccessEditorContentByPrimaryCategory({
      ...editorScopeFromSession(session),
      primaryCategoryId: access.displayPrimaryCategoryId,
    })
  ) {
    throw new PublishingError(PUBLISHING_ERROR.CONTENT_NOT_FOUND);
  }

  return access;
}
