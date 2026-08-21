import { and, eq, ne, sql } from "drizzle-orm";
import {
  assertEntityExpectedUpdatedAt,
  CONTENT_AUDIT_ACTOR_KIND,
  ENTITY_AUDIT_EVENT_TYPE,
  ENTITY_ERROR,
  ENTITY_STATUS,
  EntityError,
  MEDIA_TYPE,
  authorizeEntityWrite,
  canonicalizeEntityProfileWrite,
  decideEntityArchive,
  decideEntityReactivate,
  decideEntitySlugChange,
  decideEntityUpdate,
  nextMonotonicUpdatedAt,
  summarizeEntityAuditScalars,
  type EntityProfileWriteInput,
  type EntityStatus,
  type StaffRole,
} from "@magazine/domain";
import { getDb } from "../client";
import { media } from "../schema/media";
import {
  entities,
  entityAliases,
  entityAuditEvents,
  entitySlugHistory,
} from "../schema/entities";
import type { PublishingTx } from "../publishing/db-types";
import { rethrowEntityDbError, unwrapEntityDecision } from "./errors";
import { loadEditorEntityProjection } from "./reads";
import type { EditorEntityDetail } from "./reads";

export type EntityStaffActor = {
  staffUserId: string;
  roles: readonly StaffRole[];
};

function isActiveFromStatus(status: EntityStatus): boolean {
  return status === ENTITY_STATUS.ACTIVE;
}

function unwrapWriteAuth(roles: readonly StaffRole[]): void {
  unwrapEntityDecision(authorizeEntityWrite({ roles }));
}

async function lockEntity(tx: PublishingTx, entityId: string) {
  const [row] = await tx
    .select()
    .from(entities)
    .where(eq(entities.id, entityId))
    .for("update");
  if (!row) {
    throw new EntityError(ENTITY_ERROR.ENTITY_NOT_FOUND);
  }
  return row;
}

async function assertPortraitMedia(
  tx: PublishingTx,
  portraitMediaId: string | null,
): Promise<void> {
  if (portraitMediaId === null) {
    return;
  }
  const [row] = await tx
    .select({ id: media.id, mediaType: media.mediaType })
    .from(media)
    .where(eq(media.id, portraitMediaId))
    .limit(1);
  if (!row) {
    throw new EntityError(ENTITY_ERROR.INVALID_MEDIA);
  }
  if (row.mediaType !== MEDIA_TYPE.IMAGE) {
    throw new EntityError(ENTITY_ERROR.INVALID_MEDIA);
  }
}

async function replaceAliases(
  tx: PublishingTx,
  entityId: string,
  aliases: readonly { display: string; searchKey: string }[],
): Promise<void> {
  await tx.delete(entityAliases).where(eq(entityAliases.entityId, entityId));
  if (aliases.length === 0) {
    return;
  }
  await tx.insert(entityAliases).values(
    aliases.map((alias) => ({
      entityId,
      alias: alias.display,
      normalizedAlias: alias.searchKey,
    })),
  );
}

async function assertSlugAvailable(
  tx: PublishingTx,
  entityId: string,
  slug: string,
): Promise<void> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${slug}))`);

  const [currentOwner] = await tx
    .select({ id: entities.id })
    .from(entities)
    .where(and(eq(entities.slug, slug), ne(entities.id, entityId)))
    .limit(1);
  if (currentOwner) {
    throw new EntityError(ENTITY_ERROR.SLUG_CONFLICT);
  }

  const [historyOwner] = await tx
    .select({ entityId: entitySlugHistory.entityId })
    .from(entitySlugHistory)
    .where(
      and(
        eq(entitySlugHistory.oldSlug, slug),
        ne(entitySlugHistory.entityId, entityId),
      ),
    )
    .limit(1);
  if (historyOwner) {
    throw new EntityError(ENTITY_ERROR.SLUG_CONFLICT);
  }
}

async function recordSlugHistory(
  tx: PublishingTx,
  input: { entityId: string; oldSlug: string; actorStaffUserId: string },
): Promise<void> {
  const [existing] = await tx
    .select({ id: entitySlugHistory.id })
    .from(entitySlugHistory)
    .where(
      and(
        eq(entitySlugHistory.entityId, input.entityId),
        eq(entitySlugHistory.oldSlug, input.oldSlug),
      ),
    )
    .limit(1);
  if (existing) {
    return;
  }
  await tx.insert(entitySlugHistory).values({
    entityId: input.entityId,
    oldSlug: input.oldSlug,
    actorStaffUserId: input.actorStaffUserId,
  });
}

async function appendEntityAudit(
  tx: PublishingTx,
  input: {
    entityId: string;
    eventType: (typeof ENTITY_AUDIT_EVENT_TYPE)[keyof typeof ENTITY_AUDIT_EVENT_TYPE];
    actorStaffUserId: string;
    changeSet: Record<string, unknown> | null;
  },
): Promise<void> {
  await tx.insert(entityAuditEvents).values({
    entityId: input.entityId,
    eventType: input.eventType,
    actorKind: CONTENT_AUDIT_ACTOR_KIND.STAFF,
    actorStaffUserId: input.actorStaffUserId,
    changeSet: input.changeSet,
  });
}

export async function createEntity(input: {
  actor: EntityStaffActor;
  profile: EntityProfileWriteInput;
}): Promise<EditorEntityDetail> {
  unwrapWriteAuth(input.actor.roles);
  const write = unwrapEntityDecision(canonicalizeEntityProfileWrite(input.profile));

  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      await assertPortraitMedia(tx, write.portraitMediaId);
      const placeholderId = "00000000-0000-4000-8000-000000000000";
      await assertSlugAvailable(tx, placeholderId, write.slug);

      const [row] = await tx
        .insert(entities)
        .values({
          kind: write.kind,
          status: write.status,
          canonicalName: write.canonicalName,
          slug: write.slug,
          description: write.summary,
          biography: write.biography,
          portraitMediaId: write.portraitMediaId,
          birthDate: write.birthDate,
          occupation: write.occupation,
          officialWebsiteUrl: write.officialWebsiteUrl,
          isActive: isActiveFromStatus(write.status),
        })
        .returning();
      if (!row) {
        throw new EntityError(ENTITY_ERROR.ENTITY_NOT_FOUND);
      }

      await replaceAliases(tx, row.id, write.aliases);
      await appendEntityAudit(tx, {
        entityId: row.id,
        eventType: ENTITY_AUDIT_EVENT_TYPE.ENTITY_CREATED,
        actorStaffUserId: input.actor.staffUserId,
        changeSet: {
          fields: ["kind", "status", "canonicalName", "slug"],
          aliasCount: write.aliases.length,
        },
      });

      return loadEditorEntityProjection(tx, row.id);
    });
  } catch (error) {
    rethrowEntityDbError(error);
  }
}

export async function updateEntity(input: {
  actor: EntityStaffActor;
  entityId: string;
  expectedUpdatedAt: Date | string;
  profile: EntityProfileWriteInput;
}): Promise<EditorEntityDetail> {
  unwrapWriteAuth(input.actor.roles);
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const current = await lockEntity(tx, input.entityId);
      const currentAliases = await tx
        .select({
          aliasId: entityAliases.id,
          display: entityAliases.alias,
          searchKey: entityAliases.normalizedAlias,
        })
        .from(entityAliases)
        .where(eq(entityAliases.entityId, current.id));

      const plan = unwrapEntityDecision(
        decideEntityUpdate({
          current: {
            entityId: current.id,
            slug: current.slug,
            status: current.status,
            deletedAt: current.deletedAt,
            mergedIntoEntityId: current.mergedIntoEntityId,
            updatedAt: current.updatedAt,
          },
          write: input.profile,
          expectedUpdatedAt: input.expectedUpdatedAt,
        }),
      );

      await assertPortraitMedia(tx, plan.portraitMediaId);
      if (plan.slugChanged) {
        await assertSlugAvailable(tx, current.id, plan.slug);
        await recordSlugHistory(tx, {
          entityId: current.id,
          oldSlug: plan.previousSlug,
          actorStaffUserId: input.actor.staffUserId,
        });
      }

      const nextUpdatedAt = nextMonotonicUpdatedAt(current.updatedAt);
      await tx
        .update(entities)
        .set({
          kind: plan.kind,
          status: plan.status,
          canonicalName: plan.canonicalName,
          slug: plan.slug,
          description: plan.summary,
          biography: plan.biography,
          portraitMediaId: plan.portraitMediaId,
          birthDate: plan.birthDate,
          occupation: plan.occupation,
          officialWebsiteUrl: plan.officialWebsiteUrl,
          isActive: isActiveFromStatus(plan.status),
          updatedAt: nextUpdatedAt,
        })
        .where(eq(entities.id, current.id));

      await replaceAliases(tx, current.id, plan.aliases);

      const scalarChanges = summarizeEntityAuditScalars({
        before: {
          kind: current.kind,
          status: current.status,
          canonicalName: current.canonicalName,
          slug: current.slug,
          summary: current.description,
          portraitMediaId: current.portraitMediaId,
          birthDate: current.birthDate,
          occupation: current.occupation,
          officialWebsiteUrl: current.officialWebsiteUrl,
          aliasCount: currentAliases.length,
          mergedIntoEntityId: current.mergedIntoEntityId,
        },
        after: {
          kind: plan.kind,
          status: plan.status,
          canonicalName: plan.canonicalName,
          slug: plan.slug,
          summary: plan.summary,
          portraitMediaId: plan.portraitMediaId,
          birthDate: plan.birthDate,
          occupation: plan.occupation,
          officialWebsiteUrl: plan.officialWebsiteUrl,
          aliasCount: plan.aliases.length,
          mergedIntoEntityId: current.mergedIntoEntityId,
        },
      });

      if (plan.slugChanged) {
        await appendEntityAudit(tx, {
          entityId: current.id,
          eventType: ENTITY_AUDIT_EVENT_TYPE.ENTITY_SLUG_CHANGED,
          actorStaffUserId: input.actor.staffUserId,
          changeSet: {
            slugChange: { before: plan.previousSlug, after: plan.slug },
          },
        });
      }

      const otherChanges = scalarChanges.filter((item) => item.field !== "slug");
      if (otherChanges.length > 0) {
        await appendEntityAudit(tx, {
          entityId: current.id,
          eventType: ENTITY_AUDIT_EVENT_TYPE.ENTITY_UPDATED,
          actorStaffUserId: input.actor.staffUserId,
          changeSet: { scalarChanges: otherChanges },
        });
      }

      return loadEditorEntityProjection(tx, current.id);
    });
  } catch (error) {
    rethrowEntityDbError(error);
  }
}

export async function updateEntitySlug(input: {
  actor: EntityStaffActor;
  entityId: string;
  slug: string;
  expectedUpdatedAt: Date | string;
}): Promise<{ entityId: string; previousSlug: string; slug: string; updatedAt: Date; unchanged: boolean }> {
  unwrapWriteAuth(input.actor.roles);
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const current = await lockEntity(tx, input.entityId);
      const plan = unwrapEntityDecision(
        decideEntitySlugChange({
          requestedSlug: input.slug,
          currentSlug: current.slug,
          currentUpdatedAt: current.updatedAt,
          expectedUpdatedAt: input.expectedUpdatedAt,
          deletedAt: current.deletedAt,
          mergedIntoEntityId: current.mergedIntoEntityId,
        }),
      );

      if (plan.unchanged) {
        return {
          entityId: current.id,
          previousSlug: plan.previousSlug,
          slug: plan.nextSlug,
          updatedAt: current.updatedAt,
          unchanged: true,
        };
      }

      await assertSlugAvailable(tx, current.id, plan.nextSlug);
      await recordSlugHistory(tx, {
        entityId: current.id,
        oldSlug: plan.previousSlug,
        actorStaffUserId: input.actor.staffUserId,
      });

      const nextUpdatedAt = nextMonotonicUpdatedAt(current.updatedAt);
      await tx
        .update(entities)
        .set({
          slug: plan.nextSlug,
          updatedAt: nextUpdatedAt,
        })
        .where(eq(entities.id, current.id));

      await appendEntityAudit(tx, {
        entityId: current.id,
        eventType: ENTITY_AUDIT_EVENT_TYPE.ENTITY_SLUG_CHANGED,
        actorStaffUserId: input.actor.staffUserId,
        changeSet: {
          slugChange: { before: plan.previousSlug, after: plan.nextSlug },
        },
      });

      return {
        entityId: current.id,
        previousSlug: plan.previousSlug,
        slug: plan.nextSlug,
        updatedAt: nextUpdatedAt,
        unchanged: false,
      };
    });
  } catch (error) {
    rethrowEntityDbError(error);
  }
}

export async function archiveEntity(input: {
  actor: EntityStaffActor;
  entityId: string;
  expectedUpdatedAt: Date | string;
}): Promise<EditorEntityDetail> {
  unwrapWriteAuth(input.actor.roles);
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const current = await lockEntity(tx, input.entityId);
      unwrapEntityDecision(
        decideEntityArchive({
          status: current.status,
          deletedAt: current.deletedAt,
        }),
      );
      unwrapEntityDecision(
        assertEntityExpectedUpdatedAt({
          currentUpdatedAt: current.updatedAt,
          expectedUpdatedAt: input.expectedUpdatedAt,
        }),
      );

      const nextUpdatedAt = nextMonotonicUpdatedAt(current.updatedAt);
      await tx
        .update(entities)
        .set({
          status: ENTITY_STATUS.ARCHIVED,
          isActive: false,
          updatedAt: nextUpdatedAt,
        })
        .where(eq(entities.id, current.id));

      if (current.status !== ENTITY_STATUS.ARCHIVED) {
        await appendEntityAudit(tx, {
          entityId: current.id,
          eventType: ENTITY_AUDIT_EVENT_TYPE.ENTITY_ARCHIVED,
          actorStaffUserId: input.actor.staffUserId,
          changeSet: {
            status: { before: current.status, after: ENTITY_STATUS.ARCHIVED },
          },
        });
      }

      return loadEditorEntityProjection(tx, current.id);
    });
  } catch (error) {
    rethrowEntityDbError(error);
  }
}

export async function reactivateEntity(input: {
  actor: EntityStaffActor;
  entityId: string;
  expectedUpdatedAt: Date | string;
}): Promise<EditorEntityDetail> {
  unwrapWriteAuth(input.actor.roles);
  const db = getDb();
  try {
    return await db.transaction(async (tx) => {
      const current = await lockEntity(tx, input.entityId);
      unwrapEntityDecision(
        decideEntityReactivate({
          status: current.status,
          deletedAt: current.deletedAt,
          mergedIntoEntityId: current.mergedIntoEntityId,
        }),
      );
      unwrapEntityDecision(
        assertEntityExpectedUpdatedAt({
          currentUpdatedAt: current.updatedAt,
          expectedUpdatedAt: input.expectedUpdatedAt,
        }),
      );

      const nextUpdatedAt = nextMonotonicUpdatedAt(current.updatedAt);
      await tx
        .update(entities)
        .set({
          status: ENTITY_STATUS.ACTIVE,
          isActive: true,
          updatedAt: nextUpdatedAt,
        })
        .where(eq(entities.id, current.id));

      if (current.status !== ENTITY_STATUS.ACTIVE) {
        await appendEntityAudit(tx, {
          entityId: current.id,
          eventType: ENTITY_AUDIT_EVENT_TYPE.ENTITY_REACTIVATED,
          actorStaffUserId: input.actor.staffUserId,
          changeSet: {
            status: { before: current.status, after: ENTITY_STATUS.ACTIVE },
          },
        });
      }

      return loadEditorEntityProjection(tx, current.id);
    });
  } catch (error) {
    rethrowEntityDbError(error);
  }
}
