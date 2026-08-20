export { createContent, type CreateContentInput, type CreateContentResult } from "./create-content";
export { createDraftRevision, type CreateDraftRevisionResult } from "./create-revision";
export {
  updateDraftContent,
  type UpdateDraftContentInput,
  type UpdateDraftContentResult,
} from "./update-draft";
export {
  updateDraftScalarFields,
  type DraftScalarFields,
  type UpdateDraftScalarFieldsInput,
  type UpdateDraftScalarFieldsResult,
} from "./update-draft-scalars";
export {
  setDraftVersionHero,
  removeDraftVersionHero,
  type ArticleEditorHeroAttachment,
  type DraftVersionHeroResult,
  type SetDraftVersionHeroInput,
  type RemoveDraftVersionHeroInput,
} from "./draft-hero";
export {
  setDraftVersionGallery,
  type ArticleEditorGalleryAttachment,
  type DraftVersionGalleryResult,
  type SetDraftVersionGalleryInput,
} from "./draft-gallery";
export {
  setDraftVersionVideos,
  type ArticleEditorVideoAttachment,
  type DraftVersionVideoResult,
  type SetDraftVersionVideosInput,
} from "./draft-video";
export { approveVersion, requestChanges, submitForReview, type ReviewResult } from "./review";
export {
  executeScheduledPublish,
  publishVersion,
  unpublishContent,
  type PublishResult,
  type ScheduledPublishExecutionResult,
  type UnpublishResult,
} from "./publish";
export {
  rescheduleVersion,
  scheduleVersion,
  unscheduleVersion,
  type ScheduleResult,
} from "./schedule";
export {
  assertEditableVersion,
  getContentItem,
  getContentVersion,
} from "./reads";
export {
  recordContentLegalAction,
  listContentLegalActions,
  type RecordContentLegalActionInput,
  type RecordContentLegalActionResult,
  type ContentLegalActionRecord,
} from "./legal-actions";
export { PublishingError, PUBLISHING_ERROR } from "@magazine/domain";
