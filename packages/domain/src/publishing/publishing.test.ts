import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AUTHOR_ROLE } from "../author-role";
import { ENTITY_ROLE } from "../entity-role";
import { MEDIA_ROLE } from "../media-role";
import { PUBLICATION_STATUS } from "../publication-status";
import {
  SCHEDULED_PUBLISH_DECISION,
  decideScheduledPublishExecution,
} from "../schedule-generation";
import { versionPointersAreSeparated } from "../content-item-invariants";
import { WORKFLOW_STATUS } from "../workflow-status";
import { PUBLISHING_ERROR } from "./errors";
import {
  assertPublishReady,
  assertVersionEditable,
  decidePublish,
  decideReschedule,
  decideSchedule,
  decideUnpublish,
  decideUnschedule,
  nextScheduleGeneration,
  nextVersionNumber,
  resolveDraftRevisionSource,
  type ContentLifecycleItem,
  type ContentLifecycleVersion,
} from "./invariants";
import { assertDraftRelationInputs, copyVersionOwnedRelations } from "./relations";
import { canonicalizeContentSlug } from "./slug";
import {
  assertCanApproveVersion,
  assertCanSubmitForReview,
  assertWorkflowTransition,
} from "./transitions";

const NOW = new Date("2026-08-16T12:00:00.000Z");
const EARLIER = new Date("2026-01-01T00:00:00.000Z");
const FUTURE = new Date("2026-08-17T12:00:00.000Z");

function item(
  overrides: Partial<ContentLifecycleItem> = {},
): ContentLifecycleItem {
  return {
    id: "item-1",
    deletedAt: null,
    publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
    publishedVersionId: null,
    draftVersionId: "draft-1",
    scheduledVersionId: null,
    scheduledAt: null,
    scheduleGeneration: 0,
    publishedAt: null,
    publicDateModified: null,
    ...overrides,
  };
}

function version(
  overrides: Partial<ContentLifecycleVersion> = {},
): ContentLifecycleVersion {
  return {
    id: "draft-1",
    contentItemId: "item-1",
    workflowStatus: WORKFLOW_STATUS.APPROVED,
    isMaterialUpdate: false,
    ...overrides,
  };
}

function pointersOf(plan: {
  publishedVersionId?: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
}): {
  publishedVersionId: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
} {
  return {
    publishedVersionId: plan.publishedVersionId ?? null,
    draftVersionId: plan.draftVersionId,
    scheduledVersionId: plan.scheduledVersionId,
  };
}

describe("create content defaults", () => {
  it("canonicalizes a valid slug and rejects an invalid one", () => {
    assert.deepEqual(canonicalizeContentSlug("  Hello-World  "), {
      ok: true,
      value: "hello-world",
    });
    assert.equal(canonicalizeContentSlug("Hello World").ok, false);
    assert.equal(canonicalizeContentSlug("").ok, false);
  });

  it("starts unpublished with a draft pointer and generation 0", () => {
    const created = item({
      publicationStatus: PUBLICATION_STATUS.NEVER_PUBLISHED,
      draftVersionId: "v1",
      scheduleGeneration: 0,
    });
    assert.equal(created.publicationStatus, PUBLICATION_STATUS.NEVER_PUBLISHED);
    assert.equal(created.draftVersionId, "v1");
    assert.equal(created.publishedVersionId, null);
    assert.equal(created.scheduledVersionId, null);
    assert.equal(created.scheduleGeneration, 0);
  });
});

describe("workflow transitions", () => {
  it("accepts DRAFT -> IN_REVIEW and IN_REVIEW -> APPROVED", () => {
    assert.deepEqual(
      assertWorkflowTransition(WORKFLOW_STATUS.DRAFT, WORKFLOW_STATUS.IN_REVIEW),
      { ok: true, value: true },
    );
    assert.deepEqual(
      assertWorkflowTransition(WORKFLOW_STATUS.IN_REVIEW, WORKFLOW_STATUS.APPROVED),
      { ok: true, value: true },
    );
  });

  it("rejects DRAFT -> APPROVED, APPROVED -> DRAFT, and APPROVED -> IN_REVIEW", () => {
    assert.equal(
      assertWorkflowTransition(WORKFLOW_STATUS.DRAFT, WORKFLOW_STATUS.APPROVED).ok,
      false,
    );
    assert.equal(
      assertWorkflowTransition(WORKFLOW_STATUS.APPROVED, WORKFLOW_STATUS.DRAFT).ok,
      false,
    );
    assert.equal(
      assertWorkflowTransition(WORKFLOW_STATUS.APPROVED, WORKFLOW_STATUS.IN_REVIEW)
        .ok,
      false,
    );
  });

  it("submits and approves only the current draft owned by the item", () => {
    const submit = assertCanSubmitForReview({
      contentItemId: "item-1",
      versionContentItemId: "item-1",
      draftVersionId: "draft-1",
      versionId: "draft-1",
      workflowStatus: WORKFLOW_STATUS.DRAFT,
    });
    assert.equal(submit.ok, true);

    const wrongItem = assertCanSubmitForReview({
      contentItemId: "item-1",
      versionContentItemId: "item-2",
      draftVersionId: "draft-1",
      versionId: "draft-1",
      workflowStatus: WORKFLOW_STATUS.DRAFT,
    });
    assert.equal(wrongItem.ok, false);
    if (!wrongItem.ok) {
      assert.equal(wrongItem.code, PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM);
    }

    const notCurrent = assertCanApproveVersion({
      contentItemId: "item-1",
      versionContentItemId: "item-1",
      draftVersionId: "draft-1",
      versionId: "other",
      workflowStatus: WORKFLOW_STATUS.IN_REVIEW,
    });
    assert.equal(notCurrent.ok, false);
    if (!notCurrent.ok) {
      assert.equal(notCurrent.code, PUBLISHING_ERROR.VERSION_NOT_CURRENT_DRAFT);
    }
  });
});

describe("publish", () => {
  it("rejects DRAFT, IN_REVIEW, and APPROVED without a primary category", () => {
    assert.equal(
      decidePublish({
        item: item(),
        version: version({ workflowStatus: WORKFLOW_STATUS.DRAFT }),
        categories: [{ isPrimary: true }],
        now: NOW,
      }).ok,
      false,
    );
    assert.equal(
      decidePublish({
        item: item(),
        version: version({ workflowStatus: WORKFLOW_STATUS.IN_REVIEW }),
        categories: [{ isPrimary: true }],
        now: NOW,
      }).ok,
      false,
    );
    const noPrimary = decidePublish({
      item: item(),
      version: version(),
      categories: [{ isPrimary: false }],
      now: NOW,
    });
    assert.equal(noPrimary.ok, false);
    if (!noPrimary.ok) {
      assert.equal(noPrimary.code, PUBLISHING_ERROR.PUBLISH_READINESS_FAILED);
    }
  });

  it("accepts APPROVED with exactly one primary category", () => {
    const result = decidePublish({
      item: item(),
      version: version(),
      categories: [{ isPrimary: false }, { isPrimary: true }],
      now: NOW,
    });
    assert.equal(result.ok, true);
  });

  it("sets publishedAt on first publish and preserves it later", () => {
    const first = decidePublish({
      item: item(),
      version: version(),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(first.ok, true);
    if (!first.ok) {
      throw new Error("expected first publish");
    }
    assert.equal(first.value.publishedAt.toISOString(), NOW.toISOString());
    assert.equal(
      first.value.publicDateModified.toISOString(),
      NOW.toISOString(),
    );

    const later = decidePublish({
      item: item({
        publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
        publishedVersionId: "v1",
        publishedAt: EARLIER,
        publicDateModified: EARLIER,
        draftVersionId: "draft-1",
      }),
      version: version({ isMaterialUpdate: false }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(later.ok, true);
    if (!later.ok) {
      throw new Error("expected later publish");
    }
    assert.equal(later.value.publishedAt.toISOString(), EARLIER.toISOString());
    assert.equal(
      later.value.publicDateModified.toISOString(),
      EARLIER.toISOString(),
    );
  });

  it("updates publicDateModified only for material later publishes", () => {
    const material = decidePublish({
      item: item({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: "v1",
        publishedAt: EARLIER,
        publicDateModified: EARLIER,
        draftVersionId: "draft-1",
      }),
      version: version({ isMaterialUpdate: true }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(material.ok, true);
    if (!material.ok) {
      throw new Error("expected material publish");
    }
    assert.equal(material.value.publishedAt.toISOString(), EARLIER.toISOString());
    assert.equal(
      material.value.publicDateModified.toISOString(),
      NOW.toISOString(),
    );
  });

  it("clears the draft pointer only when publishing the current draft", () => {
    const currentDraft = decidePublish({
      item: item({ draftVersionId: "draft-1" }),
      version: version({ id: "draft-1" }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(currentDraft.ok, true);
    if (!currentDraft.ok) {
      throw new Error("expected draft publish");
    }
    assert.equal(currentDraft.value.draftVersionId, null);

    const otherDraft = decidePublish({
      item: item({
        draftVersionId: "draft-2",
        scheduledVersionId: "sched-1",
        scheduledAt: FUTURE,
      }),
      version: version({ id: "sched-1" }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(otherDraft.ok, true);
    if (!otherDraft.ok) {
      throw new Error("expected scheduled publish");
    }
    assert.equal(otherDraft.value.draftVersionId, "draft-2");
  });

  it("clears only the matching scheduled version and increments generation", () => {
    const matching = decidePublish({
      item: item({
        draftVersionId: "draft-2",
        scheduledVersionId: "sched-1",
        scheduledAt: FUTURE,
        scheduleGeneration: 4,
      }),
      version: version({ id: "sched-1" }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(matching.ok, true);
    if (!matching.ok) {
      throw new Error("expected matching schedule clear");
    }
    assert.equal(matching.value.scheduledVersionId, null);
    assert.equal(matching.value.scheduledAt, null);
    assert.equal(matching.value.scheduleGeneration, 5);

    const other = decidePublish({
      item: item({
        draftVersionId: "draft-1",
        scheduledVersionId: "sched-other",
        scheduledAt: FUTURE,
        scheduleGeneration: 4,
      }),
      version: version({ id: "draft-1" }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(other.ok, true);
    if (!other.ok) {
      throw new Error("expected other schedule preserved");
    }
    assert.equal(other.value.scheduledVersionId, "sched-other");
    assert.equal(other.value.scheduleGeneration, 4);
  });

  it("rejects an unrelated historical APPROVED version", () => {
    const historical = decidePublish({
      item: item({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: "v8",
        draftVersionId: "v10",
        publishedAt: EARLIER,
        publicDateModified: EARLIER,
      }),
      version: version({ id: "v3" }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(historical.ok, false);
    if (!historical.ok) {
      assert.equal(historical.code, PUBLISHING_ERROR.INVALID_PUBLISH_TARGET);
    }

    const ownedNeither = decidePublish({
      item: item({
        publicationStatus: PUBLICATION_STATUS.PUBLISHED,
        publishedVersionId: "v8",
        draftVersionId: "v10",
        scheduledVersionId: "v9",
        scheduledAt: FUTURE,
        publishedAt: EARLIER,
      }),
      version: version({ id: "v8" }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(ownedNeither.ok, false);
    if (!ownedNeither.ok) {
      assert.equal(ownedNeither.code, PUBLISHING_ERROR.INVALID_PUBLISH_TARGET);
    }
  });

  it("allows UNPUBLISHED republish of the preserved publishedVersionId", () => {
    const republish = decidePublish({
      item: item({
        publicationStatus: PUBLICATION_STATUS.UNPUBLISHED,
        publishedVersionId: "v8",
        draftVersionId: "v10",
        publishedAt: EARLIER,
        publicDateModified: EARLIER,
      }),
      version: version({ id: "v8" }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(republish.ok, true);
    if (!republish.ok) {
      throw new Error("expected republish");
    }
    assert.equal(republish.value.publishedVersionId, "v8");
    assert.equal(republish.value.draftVersionId, "v10");
    assert.equal(republish.value.publishedAt.toISOString(), EARLIER.toISOString());
  });

  it("still rejects a wrong item and a non-approved current draft", () => {
    const wrongItem = decidePublish({
      item: item(),
      version: version({ contentItemId: "item-2" }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(wrongItem.ok, false);
    if (!wrongItem.ok) {
      assert.equal(wrongItem.code, PUBLISHING_ERROR.VERSION_NOT_OWNED_BY_ITEM);
    }

    const notApproved = decidePublish({
      item: item({ draftVersionId: "draft-1" }),
      version: version({ workflowStatus: WORKFLOW_STATUS.DRAFT }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(notApproved.ok, false);
    if (!notApproved.ok) {
      assert.equal(notApproved.code, PUBLISHING_ERROR.VERSION_NOT_APPROVED);
    }
  });
});

describe("unpublish", () => {
  it("moves PUBLISHED to UNPUBLISHED without clearing history or schedule", () => {
    const current = item({
      publicationStatus: PUBLICATION_STATUS.PUBLISHED,
      publishedVersionId: "v7",
      publishedAt: EARLIER,
      publicDateModified: EARLIER,
      scheduledVersionId: "v9",
      scheduledAt: FUTURE,
      scheduleGeneration: 3,
    });
    const result = decideUnpublish(current);
    assert.equal(result.ok, true);
    assert.equal(decideUnpublish(item()).ok, false);
    assert.equal(current.publishedVersionId, "v7");
    assert.equal(current.publishedAt, EARLIER);
    assert.equal(current.scheduledVersionId, "v9");
  });
});

describe("schedule", () => {
  it("rejects non-approved, past time, and the current published version", () => {
    assert.equal(
      decideSchedule({
        item: item({ draftVersionId: null }),
        version: version({ workflowStatus: WORKFLOW_STATUS.DRAFT }),
        categories: [{ isPrimary: true }],
        scheduledAt: FUTURE,
        now: NOW,
      }).ok,
      false,
    );
    assert.equal(
      decideSchedule({
        item: item({ draftVersionId: null }),
        version: version(),
        categories: [{ isPrimary: true }],
        scheduledAt: EARLIER,
        now: NOW,
      }).ok,
      false,
    );
    assert.equal(
      decideSchedule({
        item: item({
          publishedVersionId: "v1",
          draftVersionId: null,
        }),
        version: version({ id: "v1" }),
        categories: [{ isPrimary: true }],
        scheduledAt: FUTURE,
        now: NOW,
      }).ok,
      false,
    );
  });

  it("increments generation on schedule, reschedule, and unschedule", () => {
    const scheduled = decideSchedule({
      item: item({ draftVersionId: "draft-2", scheduleGeneration: 2 }),
      version: version({ id: "v9" }),
      categories: [{ isPrimary: true }],
      scheduledAt: FUTURE,
      now: NOW,
    });
    assert.equal(scheduled.ok, true);
    if (!scheduled.ok) {
      throw new Error("expected schedule");
    }
    assert.equal(scheduled.value.scheduleGeneration, 3);
    assert.equal(scheduled.value.scheduledVersionId, "v9");
    assert.equal(scheduled.value.draftVersionId, "draft-2");

    const already = decideSchedule({
      item: item({
        scheduledVersionId: "v9",
        scheduledAt: FUTURE,
        scheduleGeneration: 3,
      }),
      version: version({ id: "v10" }),
      categories: [{ isPrimary: true }],
      scheduledAt: FUTURE,
      now: NOW,
    });
    assert.equal(already.ok, false);
    if (!already.ok) {
      assert.equal(already.code, PUBLISHING_ERROR.ALREADY_SCHEDULED);
    }

    const rescheduled = decideReschedule({
      item: item({
        scheduledVersionId: "v9",
        scheduledAt: FUTURE,
        scheduleGeneration: 3,
      }),
      scheduledAt: new Date("2026-08-18T12:00:00.000Z"),
      now: NOW,
    });
    assert.equal(rescheduled.ok, true);
    if (!rescheduled.ok) {
      throw new Error("expected reschedule");
    }
    assert.equal(rescheduled.value.scheduledVersionId, "v9");
    assert.equal(rescheduled.value.scheduleGeneration, 4);

    const unscheduled = decideUnschedule(
      item({
        scheduledVersionId: "v9",
        scheduledAt: FUTURE,
        scheduleGeneration: 4,
      }),
    );
    assert.equal(unscheduled.ok, true);
    if (!unscheduled.ok) {
      throw new Error("expected unschedule");
    }
    assert.equal(unscheduled.value.scheduledVersionId, null);
    assert.equal(unscheduled.value.scheduleGeneration, 5);

    const none = decideUnschedule(item({ scheduledVersionId: null }));
    assert.equal(none.ok, false);
    if (!none.ok) {
      assert.equal(none.code, PUBLISHING_ERROR.NO_SCHEDULE);
    }
  });

  it("treats stale generation as NOOP and executes only the exact scheduled version", () => {
    assert.deepEqual(
      decideScheduledPublishExecution({
        jobGeneration: 2,
        currentGeneration: 3,
        scheduledVersionId: "v9",
        scheduledAt: EARLIER,
        now: NOW,
      }),
      { decision: SCHEDULED_PUBLISH_DECISION.NOOP_STALE },
    );
    assert.deepEqual(
      decideScheduledPublishExecution({
        jobGeneration: 3,
        currentGeneration: 3,
        scheduledVersionId: null,
        scheduledAt: null,
        now: NOW,
      }),
      { decision: SCHEDULED_PUBLISH_DECISION.NOOP_NOT_SCHEDULED },
    );
    assert.deepEqual(
      decideScheduledPublishExecution({
        jobGeneration: 3,
        currentGeneration: 3,
        scheduledVersionId: "v9",
        scheduledAt: FUTURE,
        now: NOW,
      }),
      { decision: SCHEDULED_PUBLISH_DECISION.NOOP_NOT_DUE },
    );
    assert.deepEqual(
      decideScheduledPublishExecution({
        jobGeneration: 3,
        currentGeneration: 3,
        scheduledVersionId: "v9",
        scheduledAt: EARLIER,
        now: NOW,
      }),
      { decision: SCHEDULED_PUBLISH_DECISION.EXECUTE, versionId: "v9" },
    );
  });

  it("clears the matching draft pointer when scheduling the current approved draft", () => {
    const scheduled = decideSchedule({
      item: item({ draftVersionId: "v8", scheduleGeneration: 1 }),
      version: version({ id: "v8" }),
      categories: [{ isPrimary: true }],
      scheduledAt: FUTURE,
      now: NOW,
    });
    assert.equal(scheduled.ok, true);
    if (!scheduled.ok) {
      throw new Error("expected current-draft schedule");
    }
    assert.equal(scheduled.value.scheduledVersionId, "v8");
    assert.equal(scheduled.value.draftVersionId, null);
    assert.equal(scheduled.value.scheduleGeneration, 2);
    assert.equal(
      versionPointersAreSeparated(
        pointersOf({
          publishedVersionId: null,
          draftVersionId: scheduled.value.draftVersionId,
          scheduledVersionId: scheduled.value.scheduledVersionId,
        }),
      ),
      true,
    );
  });

  it("preserves an unrelated draft pointer when scheduling another version", () => {
    const scheduled = decideSchedule({
      item: item({ draftVersionId: "v9", scheduleGeneration: 1 }),
      version: version({ id: "v8" }),
      categories: [{ isPrimary: true }],
      scheduledAt: FUTURE,
      now: NOW,
    });
    assert.equal(scheduled.ok, true);
    if (!scheduled.ok) {
      throw new Error("expected unrelated-draft schedule");
    }
    assert.equal(scheduled.value.scheduledVersionId, "v8");
    assert.equal(scheduled.value.draftVersionId, "v9");
    assert.equal(scheduled.value.scheduleGeneration, 2);
  });
});

describe("editability", () => {
  it("allows only a DRAFT that is not published or scheduled", () => {
    assert.equal(
      assertVersionEditable({
        versionId: "v8",
        workflowStatus: WORKFLOW_STATUS.DRAFT,
        publishedVersionId: "v7",
        scheduledVersionId: "v9",
      }).ok,
      true,
    );
    assert.equal(
      assertVersionEditable({
        versionId: "v8",
        workflowStatus: WORKFLOW_STATUS.IN_REVIEW,
        publishedVersionId: "v7",
        scheduledVersionId: "v9",
      }).ok,
      false,
    );
    assert.equal(
      assertVersionEditable({
        versionId: "v8",
        workflowStatus: WORKFLOW_STATUS.APPROVED,
        publishedVersionId: "v7",
        scheduledVersionId: "v9",
      }).ok,
      false,
    );
    assert.equal(
      assertVersionEditable({
        versionId: "v7",
        workflowStatus: WORKFLOW_STATUS.DRAFT,
        publishedVersionId: "v7",
        scheduledVersionId: null,
      }).ok,
      false,
    );
    assert.equal(
      assertVersionEditable({
        versionId: "v9",
        workflowStatus: WORKFLOW_STATUS.DRAFT,
        publishedVersionId: "v7",
        scheduledVersionId: "v9",
      }).ok,
      false,
    );
  });
});

describe("pointer safety", () => {
  it("does not plan pointer equality for publish, schedule, or unpublish", () => {
    const publishDraft = decidePublish({
      item: item({ draftVersionId: "v8" }),
      version: version({ id: "v8" }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(publishDraft.ok, true);
    if (publishDraft.ok) {
      assert.equal(
        versionPointersAreSeparated(
          pointersOf({
            publishedVersionId: publishDraft.value.publishedVersionId,
            draftVersionId: publishDraft.value.draftVersionId,
            scheduledVersionId: publishDraft.value.scheduledVersionId,
          }),
        ),
        true,
      );
    }

    const publishScheduled = decidePublish({
      item: item({
        draftVersionId: "v10",
        scheduledVersionId: "v8",
        scheduledAt: FUTURE,
        scheduleGeneration: 2,
      }),
      version: version({ id: "v8" }),
      categories: [{ isPrimary: true }],
      now: NOW,
    });
    assert.equal(publishScheduled.ok, true);
    if (publishScheduled.ok) {
      assert.equal(publishScheduled.value.scheduleGeneration, 3);
      assert.equal(
        versionPointersAreSeparated(
          pointersOf({
            publishedVersionId: publishScheduled.value.publishedVersionId,
            draftVersionId: publishScheduled.value.draftVersionId,
            scheduledVersionId: publishScheduled.value.scheduledVersionId,
          }),
        ),
        true,
      );
    }

    const unpublished = item({
      publicationStatus: PUBLICATION_STATUS.PUBLISHED,
      publishedVersionId: "v7",
      draftVersionId: "v10",
      scheduledVersionId: "v9",
      scheduledAt: FUTURE,
      publishedAt: EARLIER,
    });
    assert.equal(decideUnpublish(unpublished).ok, true);
    assert.equal(
      versionPointersAreSeparated({
        publishedVersionId: unpublished.publishedVersionId,
        draftVersionId: unpublished.draftVersionId,
        scheduledVersionId: unpublished.scheduledVersionId,
      }),
      true,
    );
  });
});

describe("revision source", () => {
  it("does not clone a scheduled-only version unless sourceVersionId is explicit", () => {
    assert.deepEqual(
      resolveDraftRevisionSource({
        draftVersionId: null,
        publishedVersionId: "v7",
      }),
      { ok: true, value: "v7" },
    );
    assert.deepEqual(
      resolveDraftRevisionSource({
        draftVersionId: null,
        publishedVersionId: "v7",
        sourceVersionId: undefined,
      }),
      { ok: true, value: "v7" },
    );

    const scheduledOnly = resolveDraftRevisionSource({
      draftVersionId: null,
      publishedVersionId: null,
    });
    assert.equal(scheduledOnly.ok, false);
    if (!scheduledOnly.ok) {
      assert.equal(scheduledOnly.code, PUBLISHING_ERROR.NO_REVISION_SOURCE);
    }

    assert.deepEqual(
      resolveDraftRevisionSource({
        sourceVersionId: "v1",
        draftVersionId: null,
        publishedVersionId: null,
      }),
      { ok: true, value: "v1" },
    );
  });

  it("refuses to replace an existing draft", () => {
    const result = resolveDraftRevisionSource({
      sourceVersionId: "v7",
      draftVersionId: "v8",
      publishedVersionId: "v7",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, PUBLISHING_ERROR.DRAFT_ALREADY_EXISTS);
    }
  });

  it("allocates the next version number from the locked max", () => {
    assert.equal(nextVersionNumber(7), 8);
    assert.equal(nextScheduleGeneration(0), 1);
  });

  it("copies version-owned public-output relations without sharing object identity", () => {
    const source = {
      categories: [{ categoryId: "c1", isPrimary: true }],
      tags: [{ tagId: "t1" }],
      entities: [{ entityId: "e1", role: ENTITY_ROLE.SUBJECT, sortOrder: 0 }],
      media: [
        {
          mediaId: "m1",
          role: MEDIA_ROLE.HERO,
          sortOrder: 0,
          caption: "Hero",
          altText: "Alt",
          credit: "Photo",
        },
      ],
      authors: [{ authorId: "a1", role: AUTHOR_ROLE.AUTHOR, sortOrder: 0 }],
    };
    const copied = copyVersionOwnedRelations(source);
    assert.deepEqual(copied, source);
    assert.notEqual(copied.categories[0], source.categories[0]);
    assert.notEqual(copied.media[0], source.media[0]);
    source.categories[0].isPrimary = false;
    assert.equal(copied.categories[0]?.isPrimary, true);
  });

  it("rejects duplicate relations and a second HERO on draft save", () => {
    assert.equal(
      assertDraftRelationInputs({
        categories: [
          { categoryId: "c1", isPrimary: true },
          { categoryId: "c1", isPrimary: false },
        ],
      }).ok,
      false,
    );
    assert.equal(
      assertDraftRelationInputs({
        media: [
          { mediaId: "m1", role: MEDIA_ROLE.HERO },
          { mediaId: "m2", role: MEDIA_ROLE.HERO },
        ],
      }).ok,
      false,
    );
    assert.equal(
      assertDraftRelationInputs({
        categories: [{ categoryId: "c1", isPrimary: false }],
      }).ok,
      true,
    );
  });

  it("does not require a primary category to save a draft, but publish does", () => {
    assert.equal(
      assertDraftRelationInputs({
        categories: [{ categoryId: "c1", isPrimary: false }],
      }).ok,
      true,
    );
    assert.equal(
      assertPublishReady({
        workflowStatus: WORKFLOW_STATUS.APPROVED,
        categories: [{ isPrimary: false }],
      }).ok,
      false,
    );
  });
});
