import { type PublishingDecision } from "../publishing/errors";
import { diffArticleBodies } from "./diff-body";
import { diffVersionRelations } from "./diff-relations";
import { diffScalarFields } from "./diff-scalars";
import type {
  ContentVersionDiff,
  ContentVersionDiffSummary,
  DiffContentVersionsInput,
} from "./diff-types";

function versionSummary(side: DiffContentVersionsInput["from"]) {
  return {
    id: side.id,
    versionNumber: side.versionNumber,
    workflowStatus: side.workflowStatus,
    createdAt: side.createdAt,
    isCurrentDraft: side.isCurrentDraft,
    isPublishedVersion: side.isPublishedVersion,
    isScheduledVersion: side.isScheduledVersion,
  };
}

export function diffContentVersions(
  input: DiffContentVersionsInput,
): PublishingDecision<ContentVersionDiff> {
  const fields = diffScalarFields(input.from, input.to);
  const body = diffArticleBodies(input.from.body, input.to.body);
  if (!body.ok) {
    return body;
  }
  const relations = diffVersionRelations({
    fromCategories: input.from.categories,
    toCategories: input.to.categories,
    fromTags: input.from.tags,
    toTags: input.to.tags,
    fromEntities: input.from.entities,
    toEntities: input.to.entities,
    fromMedia: input.from.media,
    toMedia: input.to.media,
    fromVideos: input.from.videos,
    toVideos: input.to.videos,
    fromAuthors: input.from.authors,
    toAuthors: input.to.authors,
  });

  const summary: ContentVersionDiffSummary = {
    scalarFieldsChanged: fields.length,
    blocksAdded: body.value.blocks.filter((block) => block.changeType === "ADDED")
      .length,
    blocksRemoved: body.value.blocks.filter(
      (block) => block.changeType === "REMOVED",
    ).length,
    blocksModified: body.value.blocks.filter(
      (block) => block.changeType === "MODIFIED",
    ).length,
    blocksMoved: body.value.blocks.filter((block) => block.changeType === "MOVED")
      .length,
    bodyDetailLimited: body.value.detailLimited,
    categoriesAdded: relations.categories.added.length,
    categoriesRemoved: relations.categories.removed.length,
    primaryCategoryChanged: relations.categories.primary.changed,
    tagsAdded: relations.tags.added.length,
    tagsRemoved: relations.tags.removed.length,
    entitiesChanged:
      relations.entities.added.length > 0 ||
      relations.entities.removed.length > 0 ||
      relations.entities.modified.length > 0 ||
      relations.entities.reordered,
    mediaChanged:
      relations.media.added.length > 0 ||
      relations.media.removed.length > 0 ||
      relations.media.modified.length > 0 ||
      relations.media.reordered,
    videosChanged:
      relations.videos.added.length > 0 ||
      relations.videos.removed.length > 0 ||
      relations.videos.modified.length > 0 ||
      relations.videos.reordered,
    authorsChanged:
      relations.authors.added.length > 0 ||
      relations.authors.removed.length > 0 ||
      relations.authors.modified.length > 0 ||
      relations.authors.reordered,
    changed: false,
  };

  summary.changed =
    summary.scalarFieldsChanged > 0 ||
    body.value.changed ||
    summary.categoriesAdded > 0 ||
    summary.categoriesRemoved > 0 ||
    summary.primaryCategoryChanged ||
    summary.tagsAdded > 0 ||
    summary.tagsRemoved > 0 ||
    summary.entitiesChanged ||
    summary.mediaChanged ||
    summary.videosChanged ||
    summary.authorsChanged;

  return {
    ok: true,
    value: {
      contentItemId: input.contentItemId,
      fromVersion: versionSummary(input.from),
      toVersion: versionSummary(input.to),
      summary,
      fields,
      body: body.value,
      relations,
    },
  };
}
