import {
  articleEditorFieldsEqual,
  normalizeArticleEditorFields,
  type ArticleEditorFields,
} from "./article-editor-state";
import {
  ARTICLE_EDITOR_EMPTY_RELATIONS,
  articleEditorRelationsEqual,
  cloneArticleEditorRelations,
  type ArticleEditorRelations,
} from "./article-relation-state";
import {
  bodyEditorDocumentsEqual,
  bodyToEditorDocument,
  cloneBodyEditorDocument,
  type BodyEditorDocument,
} from "./body-editor-state";

export type ArticleEditorDraftSnapshot = {
  fields: ArticleEditorFields | null;
  relations: ArticleEditorRelations;
  body: BodyEditorDocument | null;
  bodyError: string | null;
};

export function createArticleEditorDraftSnapshot(
  version:
    | {
        fields: ArticleEditorFields;
        body: unknown;
        relations: ArticleEditorRelations;
      }
    | null
    | undefined,
): ArticleEditorDraftSnapshot {
  if (!version) {
    return {
      fields: null,
      relations: cloneArticleEditorRelations(ARTICLE_EDITOR_EMPTY_RELATIONS),
      body: null,
      bodyError: null,
    };
  }

  const parsed = bodyToEditorDocument(version.body);
  return {
    fields: normalizeArticleEditorFields(version.fields),
    relations: cloneArticleEditorRelations(version.relations),
    body: parsed.ok ? cloneBodyEditorDocument(parsed.document) : null,
    bodyError: parsed.ok ? null : parsed.message,
  };
}

export function isArticleEditorDirty(input: {
  fields: ArticleEditorFields | null;
  baseline: ArticleEditorFields | null;
  relations: ArticleEditorRelations;
  baselineRelations: ArticleEditorRelations;
  body: BodyEditorDocument | null;
  baselineBody: BodyEditorDocument | null;
}): boolean {
  if (!input.fields || !input.baseline) {
    return false;
  }

  if (!articleEditorFieldsEqual(input.fields, input.baseline)) {
    return true;
  }

  if (!articleEditorRelationsEqual(input.relations, input.baselineRelations)) {
    return true;
  }

  if (!input.body || !input.baselineBody) {
    return false;
  }

  return !bodyEditorDocumentsEqual(input.body, input.baselineBody);
}
