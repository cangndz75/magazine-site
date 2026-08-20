import { and, eq, inArray } from "drizzle-orm";
import {
  CONTENT_AUDIT_ACTOR_KIND,
  HOMEPAGE_AUDIT_EVENT_TYPE,
  HOMEPAGE_BUILDER_ERROR,
  HOMEPAGE_CONFIG_ID,
  HOMEPAGE_SLOT_KEYS,
  HomepageBuilderError,
  type HomepageAuditChangeSet,
  type HomepageBuilderDecision,
  type HomepageSlotAssignment,
  type HomepageSlotKey,
  applyHomepageFeaturedSlotSwap,
  assignmentMapFromSlots,
  assertHomepageExpectedUpdatedAt,
  assertHomepageSlotAssignmentsUnique,
  assertHomepageSlotKey,
  authorizeHomepageBuilderWrite,
  canonicalizeHomepageSlotContentItemId,
  canonicalizeHomepageVideoAssetId,
  emptyHomepageSlotMap,
  publicHomepagePlacementPointer,
  resolveHomepageFeaturedNeighborMove,
  slotsFromAssignmentMap,
  type EditorStaffScope,
  nextMonotonicUpdatedAt,
} from "@magazine/domain";
import { getDb } from "../client";
import { contentItems } from "../schema/content";
import {
  homepageAuditEvents,
  homepageSlots,
  homepageVersionVideos,
  homepageVersions,
  homepages,
} from "../schema/homepage-builder";
import { editorialVideoAssets } from "../schema/video";
import type { PublishingTx } from "../publishing/db-types";

export type EditorHomepageBuilderSlot = {
  slotKey: HomepageSlotKey;
  contentItemId: string | null;
};

export type EditorHomepageBuilderVersion = {
  versionId: string;
  publishedAt: Date | null;
  slots: EditorHomepageBuilderSlot[];
  videoAssetId: string | null;
};

export type EditorHomepageBuilderState = {
  updatedAt: Date;
  published: EditorHomepageBuilderVersion | null;
  draft: EditorHomepageBuilderVersion;
};

export type SetHomepageSlotInput = {
  scope: EditorStaffScope;
  actorId: string;
  expectedUpdatedAt: Date | string;
  slotKey: HomepageSlotKey;
  contentItemId: string | null;
};

export type ClearHomepageSlotInput = {
  scope: EditorStaffScope;
  actorId: string;
  expectedUpdatedAt: Date | string;
  slotKey: HomepageSlotKey;
};

export type PublishHomepageInput = {
  scope: EditorStaffScope;
  actorId: string;
  expectedUpdatedAt: Date | string;
};

export type MoveHomepageFeaturedSlotInput = {
  scope: EditorStaffScope;
  actorId: string;
  expectedUpdatedAt: Date | string;
  slotKey: string;
  direction: string;
};

export type SetHomepageVideoInput = {
  scope: EditorStaffScope;
  actorId: string;
  expectedUpdatedAt: Date | string;
  videoAssetId: string | null;
};

export type ClearHomepageVideoInput = {
  scope: EditorStaffScope;
  actorId: string;
  expectedUpdatedAt: Date | string;
};

function unwrapDecision<T>(decision: HomepageBuilderDecision<T>): T {
  if (!decision.ok) {
    throw new HomepageBuilderError(decision.code);
  }
  return decision.value;
}

function authorize(scope: EditorStaffScope): void {
  unwrapDecision(authorizeHomepageBuilderWrite(scope));
}

async function lockHomepage(tx: PublishingTx) {
  const [row] = await tx
    .select()
    .from(homepages)
    .where(eq(homepages.id, HOMEPAGE_CONFIG_ID))
    .for("update");
  if (!row) {
    throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.NO_DRAFT);
  }
  return row;
}

async function loadSlotsForVersion(
  tx: PublishingTx,
  versionId: string,
): Promise<HomepageSlotAssignment[]> {
  const rows = await tx
    .select({
      slotKey: homepageSlots.slotKey,
      contentItemId: homepageSlots.contentItemId,
    })
    .from(homepageSlots)
    .where(eq(homepageSlots.homepageVersionId, versionId));

  const map = emptyHomepageSlotMap();
  for (const row of rows) {
    map[row.slotKey] = row.contentItemId;
  }
  return slotsFromAssignmentMap(map);
}

async function loadVideoAssetIdForVersion(
  tx: PublishingTx,
  versionId: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ videoAssetId: homepageVersionVideos.videoAssetId })
    .from(homepageVersionVideos)
    .where(eq(homepageVersionVideos.homepageVersionId, versionId))
    .limit(1);
  return row?.videoAssetId ?? null;
}

async function assertDraftContentItemExists(
  tx: PublishingTx,
  contentItemId: string | null,
): Promise<void> {
  if (contentItemId === null) {
    return;
  }
  const [item] = await tx
    .select({ id: contentItems.id, deletedAt: contentItems.deletedAt })
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId))
    .limit(1);
  if (!item || item.deletedAt !== null) {
    throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.INVALID_CONTENT_ITEM);
  }
}

async function assertDraftVideoAssetExists(
  tx: PublishingTx,
  videoAssetId: string | null,
): Promise<void> {
  if (videoAssetId === null) {
    return;
  }
  const [asset] = await tx
    .select({ id: editorialVideoAssets.id })
    .from(editorialVideoAssets)
    .where(eq(editorialVideoAssets.id, videoAssetId))
    .limit(1);
  if (!asset) {
    throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.INVALID_VIDEO_ASSET);
  }
}

async function assertPublishSafeVideoAssignment(
  tx: PublishingTx,
  videoAssetId: string | null,
): Promise<void> {
  if (videoAssetId === null) {
    return;
  }
  const [asset] = await tx
    .select({ id: editorialVideoAssets.id })
    .from(editorialVideoAssets)
    .where(eq(editorialVideoAssets.id, videoAssetId))
    .limit(1);
  if (!asset) {
    throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.PUBLISH_VALIDATION_FAILED);
  }
}

async function assertPublishSafeAssignments(
  tx: PublishingTx,
  assignments: readonly HomepageSlotAssignment[],
): Promise<void> {
  const ids = assignments
    .map((slot) => slot.contentItemId)
    .filter((id): id is string => id !== null);
  if (ids.length === 0) {
    return;
  }

  const rows = await tx
    .select({
      id: contentItems.id,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      deletedAt: contentItems.deletedAt,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
    })
    .from(contentItems)
    .where(inArray(contentItems.id, ids));

  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) {
      throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.PUBLISH_VALIDATION_FAILED);
    }
    const pointer = publicHomepagePlacementPointer({
      contentItemId: row.id,
      publicationStatus: row.publicationStatus,
      publishedVersionId: row.publishedVersionId,
      deletedAt: row.deletedAt,
      retractedAt: row.retractedAt,
      takedownAt: row.takedownAt,
    });
    if (!pointer) {
      throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.PUBLISH_VALIDATION_FAILED);
    }
  }
}

async function persistHomepageSlotPair(
  tx: PublishingTx,
  draftVersionId: string,
  currentRows: readonly { slotKey: HomepageSlotKey }[],
  from: HomepageSlotKey,
  to: HomepageSlotKey,
  nextMap: Readonly<Record<HomepageSlotKey, string | null>>,
): Promise<void> {
  for (const slotKey of [from, to]) {
    const existingRow = currentRows.some((row) => row.slotKey === slotKey);
    if (existingRow) {
      await tx
        .delete(homepageSlots)
        .where(
          and(
            eq(homepageSlots.homepageVersionId, draftVersionId),
            eq(homepageSlots.slotKey, slotKey),
          ),
        );
    }
  }

  for (const slotKey of [from, to]) {
    const contentItemId = nextMap[slotKey];
    if (contentItemId !== null) {
      await tx.insert(homepageSlots).values({
        homepageVersionId: draftVersionId,
        slotKey,
        contentItemId,
      });
    }
  }
}

async function cloneVersionAssignments(
  tx: PublishingTx,
  sourceVersionId: string,
  targetVersionId: string,
): Promise<void> {
  await cloneSlots(tx, sourceVersionId, targetVersionId);
  await cloneVideo(tx, sourceVersionId, targetVersionId);
}

async function cloneVideo(
  tx: PublishingTx,
  sourceVersionId: string,
  targetVersionId: string,
): Promise<void> {
  const [row] = await tx
    .select({ videoAssetId: homepageVersionVideos.videoAssetId })
    .from(homepageVersionVideos)
    .where(eq(homepageVersionVideos.homepageVersionId, sourceVersionId))
    .limit(1);
  if (!row) {
    return;
  }
  await tx.insert(homepageVersionVideos).values({
    homepageVersionId: targetVersionId,
    videoAssetId: row.videoAssetId,
  });
}

async function cloneSlots(
  tx: PublishingTx,
  sourceVersionId: string,
  targetVersionId: string,
): Promise<void> {
  const rows = await tx
    .select()
    .from(homepageSlots)
    .where(eq(homepageSlots.homepageVersionId, sourceVersionId));
  if (rows.length === 0) {
    return;
  }
  await tx.insert(homepageSlots).values(
    rows.map((row) => ({
      homepageVersionId: targetVersionId,
      slotKey: row.slotKey,
      contentItemId: row.contentItemId,
    })),
  );
}

async function createHomepageVersion(
  tx: PublishingTx,
  createdByStaffUserId: string,
): Promise<string> {
  const [version] = await tx
    .insert(homepageVersions)
    .values({
      homepageId: HOMEPAGE_CONFIG_ID,
      createdByStaffUserId,
    })
    .returning({ id: homepageVersions.id });
  return version.id;
}

async function ensureHomepageConfig(tx: PublishingTx): Promise<typeof homepages.$inferSelect> {
  const [existing] = await tx
    .select()
    .from(homepages)
    .where(eq(homepages.id, HOMEPAGE_CONFIG_ID))
    .limit(1);
  if (existing) {
    return existing;
  }
  const created = await tx
    .insert(homepages)
    .values({ id: HOMEPAGE_CONFIG_ID })
    .returning();
  const row = created[0];
  if (!row) {
    throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.NO_DRAFT);
  }
  return row;
}

async function ensureDraftVersion(
  tx: PublishingTx,
  config: typeof homepages.$inferSelect,
  actorId: string,
): Promise<string> {
  if (config.draftVersionId) {
    return config.draftVersionId;
  }

  const draftVersionId = await createHomepageVersion(tx, actorId);
  if (config.publishedVersionId) {
    await cloneVersionAssignments(tx, config.publishedVersionId, draftVersionId);
  }

  await tx
    .update(homepages)
    .set({
      draftVersionId,
      updatedAt: nextMonotonicUpdatedAt(config.updatedAt),
    })
    .where(eq(homepages.id, HOMEPAGE_CONFIG_ID));

  return draftVersionId;
}

async function appendHomepageAudit(
  tx: PublishingTx,
  input: {
    homepageVersionId: string | null;
    eventType: typeof HOMEPAGE_AUDIT_EVENT_TYPE.HOMEPAGE_DRAFT_UPDATED | typeof HOMEPAGE_AUDIT_EVENT_TYPE.HOMEPAGE_PUBLISHED;
    actorStaffUserId: string;
    changeSet: HomepageAuditChangeSet | null;
  },
): Promise<void> {
  await tx.insert(homepageAuditEvents).values({
    homepageVersionId: input.homepageVersionId,
    eventType: input.eventType,
    actorKind: CONTENT_AUDIT_ACTOR_KIND.STAFF,
    actorStaffUserId: input.actorStaffUserId,
    changeSet: input.changeSet,
  });
}

function toEditorVersion(
  versionId: string,
  publishedAt: Date | null,
  slots: HomepageSlotAssignment[],
  videoAssetId: string | null,
): EditorHomepageBuilderVersion {
  return {
    versionId,
    publishedAt,
    slots: slots.map((slot) => ({
      slotKey: slot.slotKey,
      contentItemId: slot.contentItemId,
    })),
    videoAssetId,
  };
}

async function buildEditorState(
  tx: PublishingTx,
  locked: typeof homepages.$inferSelect,
): Promise<EditorHomepageBuilderState> {
  if (!locked.draftVersionId) {
    throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.NO_DRAFT);
  }
  const draftSlots = await loadSlotsForVersion(tx, locked.draftVersionId);
  const draftVideoAssetId = await loadVideoAssetIdForVersion(
    tx,
    locked.draftVersionId,
  );
  let published: EditorHomepageBuilderVersion | null = null;
  if (locked.publishedVersionId) {
    const [publishedVersion] = await tx
      .select({
        id: homepageVersions.id,
        publishedAt: homepageVersions.publishedAt,
      })
      .from(homepageVersions)
      .where(eq(homepageVersions.id, locked.publishedVersionId))
      .limit(1);
    if (publishedVersion) {
      const publishedSlots = await loadSlotsForVersion(tx, publishedVersion.id);
      const publishedVideoAssetId = await loadVideoAssetIdForVersion(
        tx,
        publishedVersion.id,
      );
      published = toEditorVersion(
        publishedVersion.id,
        publishedVersion.publishedAt,
        publishedSlots,
        publishedVideoAssetId,
      );
    }
  }
  return {
    updatedAt: locked.updatedAt,
    published,
    draft: toEditorVersion(
      locked.draftVersionId,
      null,
      draftSlots,
      draftVideoAssetId,
    ),
  };
}

export async function getHomepageBuilder(
  scope: EditorStaffScope,
  actorId: string,
): Promise<EditorHomepageBuilderState> {
  authorize(scope);
  const db = getDb();
  return db.transaction(async (tx) => {
    const config = await ensureHomepageConfig(tx);
    await ensureDraftVersion(tx, config, actorId);
    const locked = await lockHomepage(tx);
    return buildEditorState(tx, locked);
  });
}

export async function setHomepageSlot(
  input: SetHomepageSlotInput,
): Promise<EditorHomepageBuilderState> {
  authorize(input.scope);
  unwrapDecision(assertHomepageSlotKey(input.slotKey));
  const contentItemId = unwrapDecision(
    canonicalizeHomepageSlotContentItemId(input.contentItemId),
  );

  const db = getDb();
  return db.transaction(async (tx) => {
    const config = await ensureHomepageConfig(tx);
    const draftVersionId = await ensureDraftVersion(tx, config, input.actorId);
    const locked = await lockHomepage(tx);
    unwrapDecision(
      assertHomepageExpectedUpdatedAt({
        currentUpdatedAt: locked.updatedAt,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    );

    const currentRows = await tx
      .select({
        slotKey: homepageSlots.slotKey,
        contentItemId: homepageSlots.contentItemId,
      })
      .from(homepageSlots)
      .where(eq(homepageSlots.homepageVersionId, draftVersionId));
    const currentSlots = slotsFromAssignmentMap(
      assignmentMapFromSlots(
        currentRows.map((row) => ({
          slotKey: row.slotKey,
          contentItemId: row.contentItemId,
        })),
      ),
    );
    const nextMap = assignmentMapFromSlots(currentSlots);
    nextMap[input.slotKey] = contentItemId;
    const nextSlots = slotsFromAssignmentMap(nextMap);
    unwrapDecision(assertHomepageSlotAssignmentsUnique(nextSlots));
    await assertDraftContentItemExists(tx, contentItemId);

    const previousContentItemId =
      currentRows.find((row) => row.slotKey === input.slotKey)?.contentItemId ??
      null;
    const existingRow = currentRows.some((row) => row.slotKey === input.slotKey);

    if (contentItemId === null) {
      if (existingRow) {
        await tx
          .delete(homepageSlots)
          .where(
            and(
              eq(homepageSlots.homepageVersionId, draftVersionId),
              eq(homepageSlots.slotKey, input.slotKey),
            ),
          );
      }
    } else if (existingRow) {
      await tx
        .update(homepageSlots)
        .set({ contentItemId })
        .where(
          and(
            eq(homepageSlots.homepageVersionId, draftVersionId),
            eq(homepageSlots.slotKey, input.slotKey),
          ),
        );
    } else {
      await tx.insert(homepageSlots).values({
        homepageVersionId: draftVersionId,
        slotKey: input.slotKey,
        contentItemId,
      });
    }

    const nextUpdatedAt = nextMonotonicUpdatedAt(locked.updatedAt);
    await tx
      .update(homepageVersions)
      .set({ updatedAt: nextUpdatedAt })
      .where(eq(homepageVersions.id, draftVersionId));
    await tx
      .update(homepages)
      .set({ updatedAt: nextUpdatedAt })
      .where(eq(homepages.id, HOMEPAGE_CONFIG_ID));

    await appendHomepageAudit(tx, {
      homepageVersionId: draftVersionId,
      eventType: HOMEPAGE_AUDIT_EVENT_TYPE.HOMEPAGE_DRAFT_UPDATED,
      actorStaffUserId: input.actorId,
      changeSet: {
        slots: [
          {
            slotKey: input.slotKey,
            previousContentItemId,
            nextContentItemId: contentItemId,
          },
        ],
      },
    });

    const [refreshed] = await tx
      .select()
      .from(homepages)
      .where(eq(homepages.id, HOMEPAGE_CONFIG_ID))
      .limit(1);
    if (!refreshed) {
      throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.NO_DRAFT);
    }
    return buildEditorState(tx, refreshed);
  });
}

export async function clearHomepageSlot(
  input: ClearHomepageSlotInput,
): Promise<EditorHomepageBuilderState> {
  return setHomepageSlot({
    scope: input.scope,
    actorId: input.actorId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    slotKey: input.slotKey,
    contentItemId: null,
  });
}

export async function moveHomepageFeaturedSlot(
  input: MoveHomepageFeaturedSlotInput,
): Promise<EditorHomepageBuilderState> {
  authorize(input.scope);
  const move = unwrapDecision(
    resolveHomepageFeaturedNeighborMove({
      slotKey: input.slotKey,
      direction: input.direction,
    }),
  );

  const db = getDb();
  return db.transaction(async (tx) => {
    const config = await ensureHomepageConfig(tx);
    const draftVersionId = await ensureDraftVersion(tx, config, input.actorId);
    const locked = await lockHomepage(tx);
    unwrapDecision(
      assertHomepageExpectedUpdatedAt({
        currentUpdatedAt: locked.updatedAt,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    );

    const currentRows = await tx
      .select({
        slotKey: homepageSlots.slotKey,
        contentItemId: homepageSlots.contentItemId,
      })
      .from(homepageSlots)
      .where(eq(homepageSlots.homepageVersionId, draftVersionId));
    const currentMap = assignmentMapFromSlots(
      currentRows.map((row) => ({
        slotKey: row.slotKey,
        contentItemId: row.contentItemId,
      })),
    );
    const nextMap = applyHomepageFeaturedSlotSwap(
      currentMap,
      move.from,
      move.to,
    );
    const previousFrom = currentMap[move.from] ?? null;
    const previousTo = currentMap[move.to] ?? null;
    const nextFrom = nextMap[move.from] ?? null;
    const nextTo = nextMap[move.to] ?? null;

    if (previousFrom === nextFrom && previousTo === nextTo) {
      return buildEditorState(tx, locked);
    }

    unwrapDecision(assertHomepageSlotAssignmentsUnique(slotsFromAssignmentMap(nextMap)));
    await persistHomepageSlotPair(
      tx,
      draftVersionId,
      currentRows,
      move.from,
      move.to,
      nextMap,
    );

    const nextUpdatedAt = nextMonotonicUpdatedAt(locked.updatedAt);
    await tx
      .update(homepageVersions)
      .set({ updatedAt: nextUpdatedAt })
      .where(eq(homepageVersions.id, draftVersionId));
    await tx
      .update(homepages)
      .set({ updatedAt: nextUpdatedAt })
      .where(eq(homepages.id, HOMEPAGE_CONFIG_ID));

    await appendHomepageAudit(tx, {
      homepageVersionId: draftVersionId,
      eventType: HOMEPAGE_AUDIT_EVENT_TYPE.HOMEPAGE_DRAFT_UPDATED,
      actorStaffUserId: input.actorId,
      changeSet: {
        slots: [
          {
            slotKey: move.from,
            previousContentItemId: previousFrom,
            nextContentItemId: nextFrom,
          },
          {
            slotKey: move.to,
            previousContentItemId: previousTo,
            nextContentItemId: nextTo,
          },
        ],
      },
    });

    const [refreshed] = await tx
      .select()
      .from(homepages)
      .where(eq(homepages.id, HOMEPAGE_CONFIG_ID))
      .limit(1);
    if (!refreshed) {
      throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.NO_DRAFT);
    }
    return buildEditorState(tx, refreshed);
  });
}

export async function publishHomepage(
  input: PublishHomepageInput,
): Promise<EditorHomepageBuilderState> {
  authorize(input.scope);
  const db = getDb();
  return db.transaction(async (tx) => {
    const config = await ensureHomepageConfig(tx);
    const draftVersionId = await ensureDraftVersion(tx, config, input.actorId);
    const locked = await lockHomepage(tx);
    unwrapDecision(
      assertHomepageExpectedUpdatedAt({
        currentUpdatedAt: locked.updatedAt,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    );

    const draftSlots = await loadSlotsForVersion(tx, draftVersionId);
    const draftVideoAssetId = await loadVideoAssetIdForVersion(tx, draftVersionId);
    unwrapDecision(assertHomepageSlotAssignmentsUnique(draftSlots));
    await assertPublishSafeAssignments(tx, draftSlots);
    await assertPublishSafeVideoAssignment(tx, draftVideoAssetId);

    const now = new Date();
    await tx
      .update(homepageVersions)
      .set({ publishedAt: now, updatedAt: now })
      .where(eq(homepageVersions.id, draftVersionId));

    const nextDraftVersionId = await createHomepageVersion(tx, input.actorId);
    await cloneVersionAssignments(tx, draftVersionId, nextDraftVersionId);

    const nextUpdatedAt = nextMonotonicUpdatedAt(locked.updatedAt, now);
    await tx
      .update(homepages)
      .set({
        publishedVersionId: draftVersionId,
        draftVersionId: nextDraftVersionId,
        updatedAt: nextUpdatedAt,
      })
      .where(eq(homepages.id, HOMEPAGE_CONFIG_ID));

    await appendHomepageAudit(tx, {
      homepageVersionId: draftVersionId,
      eventType: HOMEPAGE_AUDIT_EVENT_TYPE.HOMEPAGE_PUBLISHED,
      actorStaffUserId: input.actorId,
      changeSet: {
        publishedVersionId: draftVersionId,
        slots: draftSlots.map((slot) => ({
          slotKey: slot.slotKey,
          previousContentItemId: null,
          nextContentItemId: slot.contentItemId,
        })),
        video: {
          previousVideoAssetId: null,
          nextVideoAssetId: draftVideoAssetId,
        },
      },
    });

    const [refreshed] = await tx
      .select()
      .from(homepages)
      .where(eq(homepages.id, HOMEPAGE_CONFIG_ID))
      .limit(1);
    if (!refreshed) {
      throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.NO_DRAFT);
    }
    return buildEditorState(tx, refreshed);
  });
}

export async function loadPublishedHomepageSlotMap(): Promise<Record<
  HomepageSlotKey,
  string | null
> | null> {
  const db = getDb();
  const [config] = await db
    .select({ publishedVersionId: homepages.publishedVersionId })
    .from(homepages)
    .where(eq(homepages.id, HOMEPAGE_CONFIG_ID))
    .limit(1);
  if (!config?.publishedVersionId) {
    return null;
  }
  const rows = await db
    .select({
      slotKey: homepageSlots.slotKey,
      contentItemId: homepageSlots.contentItemId,
    })
    .from(homepageSlots)
    .where(eq(homepageSlots.homepageVersionId, config.publishedVersionId));
  const map = emptyHomepageSlotMap();
  for (const row of rows) {
    map[row.slotKey] = row.contentItemId;
  }
  return map;
}

export async function loadPublicSafeEditorialContentItemIds(
  editorialMap: Readonly<Record<HomepageSlotKey, string | null>>,
): Promise<Record<HomepageSlotKey, string | null>> {
  const ids = HOMEPAGE_SLOT_KEYS
    .map((key) => editorialMap[key])
    .filter((id): id is string => id !== null);
  if (ids.length === 0) {
    return editorialMap;
  }
  const db = getDb();
  const rows = await db
    .select({
      id: contentItems.id,
      publicationStatus: contentItems.publicationStatus,
      publishedVersionId: contentItems.publishedVersionId,
      deletedAt: contentItems.deletedAt,
      retractedAt: contentItems.retractedAt,
      takedownAt: contentItems.takedownAt,
    })
    .from(contentItems)
    .where(inArray(contentItems.id, ids));

  const publicIds = new Set<string>();
  for (const row of rows) {
    if (
      publicHomepagePlacementPointer({
        contentItemId: row.id,
        publicationStatus: row.publicationStatus,
        publishedVersionId: row.publishedVersionId,
        deletedAt: row.deletedAt,
        retractedAt: row.retractedAt,
        takedownAt: row.takedownAt,
      })
    ) {
      publicIds.add(row.id);
    }
  }

  const resolved = { ...editorialMap };
  for (const key of HOMEPAGE_SLOT_KEYS) {
    const id = editorialMap[key];
    if (id !== null && !publicIds.has(id)) {
      resolved[key] = null;
    }
  }
  return resolved;
}

export async function setHomepageVideo(
  input: SetHomepageVideoInput,
): Promise<EditorHomepageBuilderState> {
  authorize(input.scope);
  const videoAssetId = unwrapDecision(
    canonicalizeHomepageVideoAssetId(input.videoAssetId),
  );

  const db = getDb();
  return db.transaction(async (tx) => {
    const config = await ensureHomepageConfig(tx);
    const draftVersionId = await ensureDraftVersion(tx, config, input.actorId);
    const locked = await lockHomepage(tx);
    unwrapDecision(
      assertHomepageExpectedUpdatedAt({
        currentUpdatedAt: locked.updatedAt,
        expectedUpdatedAt: input.expectedUpdatedAt,
      }),
    );

    const previousVideoAssetId = await loadVideoAssetIdForVersion(
      tx,
      draftVersionId,
    );
    await assertDraftVideoAssetExists(tx, videoAssetId);

    if (videoAssetId === null) {
      await tx
        .delete(homepageVersionVideos)
        .where(eq(homepageVersionVideos.homepageVersionId, draftVersionId));
    } else {
      const [existing] = await tx
        .select({ homepageVersionId: homepageVersionVideos.homepageVersionId })
        .from(homepageVersionVideos)
        .where(eq(homepageVersionVideos.homepageVersionId, draftVersionId))
        .limit(1);
      if (existing) {
        await tx
          .update(homepageVersionVideos)
          .set({ videoAssetId })
          .where(eq(homepageVersionVideos.homepageVersionId, draftVersionId));
      } else {
        await tx.insert(homepageVersionVideos).values({
          homepageVersionId: draftVersionId,
          videoAssetId,
        });
      }
    }

    const nextUpdatedAt = nextMonotonicUpdatedAt(locked.updatedAt);
    await tx
      .update(homepageVersions)
      .set({ updatedAt: nextUpdatedAt })
      .where(eq(homepageVersions.id, draftVersionId));
    await tx
      .update(homepages)
      .set({ updatedAt: nextUpdatedAt })
      .where(eq(homepages.id, HOMEPAGE_CONFIG_ID));

    await appendHomepageAudit(tx, {
      homepageVersionId: draftVersionId,
      eventType: HOMEPAGE_AUDIT_EVENT_TYPE.HOMEPAGE_DRAFT_UPDATED,
      actorStaffUserId: input.actorId,
      changeSet: {
        video: {
          previousVideoAssetId,
          nextVideoAssetId: videoAssetId,
        },
      },
    });

    const [refreshed] = await tx
      .select()
      .from(homepages)
      .where(eq(homepages.id, HOMEPAGE_CONFIG_ID))
      .limit(1);
    if (!refreshed) {
      throw new HomepageBuilderError(HOMEPAGE_BUILDER_ERROR.NO_DRAFT);
    }
    return buildEditorState(tx, refreshed);
  });
}

export async function clearHomepageVideo(
  input: ClearHomepageVideoInput,
): Promise<EditorHomepageBuilderState> {
  return setHomepageVideo({
    scope: input.scope,
    actorId: input.actorId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    videoAssetId: null,
  });
}

export async function loadPublishedHomepageVideoAssetId(): Promise<string | null> {
  const db = getDb();
  const [config] = await db
    .select({ publishedVersionId: homepages.publishedVersionId })
    .from(homepages)
    .where(eq(homepages.id, HOMEPAGE_CONFIG_ID))
    .limit(1);
  if (!config?.publishedVersionId) {
    return null;
  }
  const [row] = await db
    .select({ videoAssetId: homepageVersionVideos.videoAssetId })
    .from(homepageVersionVideos)
    .where(eq(homepageVersionVideos.homepageVersionId, config.publishedVersionId))
    .limit(1);
  return row?.videoAssetId ?? null;
}
