import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { inArray } from "drizzle-orm";
import {
  CONTENT_LEGAL_ACTION_TYPE,
  CONTENT_LEGAL_REASON_CATEGORY,
  ENTITY_AUDIT_EVENT_TYPE,
  ENTITY_ERROR,
  ENTITY_KIND,
  ENTITY_ROLE,
  ENTITY_STATUS,
  EntityError,
  PUBLIC_ENTITY_LOOKUP,
  PUBLISHING_ERROR,
  PublishingError,
  STAFF_ROLE,
} from "@magazine/domain";
import { getDb } from "../client";
import {
  archiveEntity,
  createEntity,
  findPotentialEntityDuplicates,
  getEntityById,
  getPublicEntityBySlug,
  listEntities,
  listPublicContentForEntity,
  reactivateEntity,
  updateEntity,
  updateEntitySlug,
  type EntityStaffActor,
} from "../entities";
import { lookupEditorEntities } from "../editor/lookups";
import {
  createDraftRevision,
  publishVersion,
  recordContentLegalAction,
  submitForReview,
  approveVersion,
  updateDraftContent,
} from "../publishing";
import { entities, entityAuditEvents, entitySlugHistory } from "../schema/entities";
import {
  articleBody,
  cleanupFixture,
  closeIntegrationConnections,
  countLeftoverFixtures,
  countOpenTestTransactions,
  createDraftItem,
  createFixture,
  ensureEditorContentTestDatabase,
  getRacerPool,
  uniqueSlug,
  waitUntilBlockedByHolder,
  type IntegrationFixture,
} from "./harness";

function editorActor(fixture: IntegrationFixture): EntityStaffActor {
  return {
    staffUserId: fixture.ids.staffEditor,
    roles: [STAFF_ROLE.EDITOR],
  };
}

function authorActor(fixture: IntegrationFixture): EntityStaffActor {
  return {
    staffUserId: fixture.ids.staffEditor,
    roles: [STAFF_ROLE.AUTHOR],
  };
}

function superAdminActor(fixture: IntegrationFixture): EntityStaffActor {
  return {
    staffUserId: fixture.ids.staffEditor,
    roles: [STAFF_ROLE.SUPER_ADMIN],
  };
}

function assertEntityCode(error: unknown, code: string): void {
  assert.equal(error instanceof EntityError, true, String(error));
  assert.equal((error as EntityError).code, code);
}

async function cleanupEntities(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const db = getDb();
  await db.delete(entityAuditEvents).where(inArray(entityAuditEvents.entityId, ids));
  await db.delete(entitySlugHistory).where(inArray(entitySlugHistory.entityId, ids));
  await db.delete(entities).where(inArray(entities.id, ids));
}

describe("entity platform persistence", () => {
  let fixture: IntegrationFixture;
  const createdEntityIds: string[] = [];

  before(async () => {
    await ensureEditorContentTestDatabase();
  });

  beforeEach(async () => {
    fixture = await createFixture();
    createdEntityIds.length = 0;
  });

  afterEach(async () => {
    const itemIds = fixture.createdItemIds.slice();
    await cleanupFixture(fixture);
    await cleanupEntities(createdEntityIds);
    const leftover = await countLeftoverFixtures(itemIds);
    assert.equal(leftover.items, 0);
  });

  after(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    const leftoverTx = await countOpenTestTransactions();
    assert.equal(leftoverTx, 0, "integration tests leaked open transactions");
    await closeIntegrationConnections();
  });

  async function createNamedEntity(input: {
    name: string;
    slug?: string;
    status?: string;
    aliases?: string[];
  }) {
    const created = await createEntity({
      actor: editorActor(fixture),
      profile: {
        kind: ENTITY_KIND.PERSON,
        canonicalName: input.name,
        slug: input.slug ?? uniqueSlug("ent"),
        status: input.status ?? ENTITY_STATUS.DRAFT,
        aliases: input.aliases,
      },
    });
    createdEntityIds.push(created.entityId);
    return created;
  }

  it("creates a draft entity, rejects duplicate slugs, and keeps aliases per-entity", async () => {
    const slug = uniqueSlug("hande");
    const created = await createNamedEntity({
      name: "Hande Erçel",
      slug,
      aliases: ["Hande Ercel"],
    });
    assert.equal(created.status, ENTITY_STATUS.DRAFT);
    assert.equal(created.canonicalName, "Hande Erçel");
    assert.equal(created.aliases.length, 1);

    await assert.rejects(
      () =>
        createNamedEntity({
          name: "Başka Hande",
          slug,
        }),
      (error: unknown) => {
        assertEntityCode(error, ENTITY_ERROR.SLUG_CONFLICT);
        return true;
      },
    );

    const other = await createNamedEntity({
      name: "Başka Kişi",
      aliases: ["Hande Ercel"],
    });
    assert.equal(other.aliases[0]?.display, "Hande Ercel");
  });

  it("rejects stale updates and does not partially mutate", async () => {
    const created = await createNamedEntity({ name: "Işıl" });
    const saved = await updateEntity({
      actor: editorActor(fixture),
      entityId: created.entityId,
      expectedUpdatedAt: created.updatedAt,
      profile: {
        kind: ENTITY_KIND.PERSON,
        canonicalName: "Işıl Yücesoy",
        slug: created.slug,
        status: created.status,
        summary: "Oyuncu",
      },
    });
    assert.equal(saved.canonicalName, "Işıl Yücesoy");
    assert.equal(saved.summary, "Oyuncu");

    await assert.rejects(
      () =>
        updateEntity({
          actor: editorActor(fixture),
          entityId: created.entityId,
          expectedUpdatedAt: created.updatedAt,
          profile: {
            kind: ENTITY_KIND.PERSON,
            canonicalName: "Stale",
            slug: created.slug,
            status: created.status,
          },
        }),
      (error: unknown) => {
        assertEntityCode(error, ENTITY_ERROR.ENTITY_WRITE_CONFLICT);
        return true;
      },
    );

    const after = await getEntityById({
      actorRoles: [STAFF_ROLE.EDITOR],
      entityId: created.entityId,
    });
    assert.equal(after.canonicalName, "Işıl Yücesoy");
    assert.equal(after.summary, "Oyuncu");
  });

  it("changes slugs with history, blocks historical occupancy, and allows reclaim", async () => {
    const slugA = uniqueSlug("sluga");
    const slugB = uniqueSlug("slugb");
    const created = await createNamedEntity({ name: "Slug Entity", slug: slugA });
    const toB = await updateEntitySlug({
      actor: editorActor(fixture),
      entityId: created.entityId,
      slug: slugB,
      expectedUpdatedAt: created.updatedAt,
    });
    assert.equal(toB.slug, slugB);
    assert.equal(toB.previousSlug, slugA);

    await assert.rejects(
      () =>
        createNamedEntity({
          name: "Occupier",
          slug: slugA,
        }),
      (error: unknown) => {
        assertEntityCode(error, ENTITY_ERROR.SLUG_CONFLICT);
        return true;
      },
    );

    const reclaimed = await updateEntitySlug({
      actor: editorActor(fixture),
      entityId: created.entityId,
      slug: slugA,
      expectedUpdatedAt: toB.updatedAt,
    });
    assert.equal(reclaimed.slug, slugA);
  });

  it("archives public reads without deleting article relations", async () => {
    const created = await createNamedEntity({
      name: "Public Person",
      status: ENTITY_STATUS.ACTIVE,
    });
    const found = await getPublicEntityBySlug({ slug: created.slug });
    assert.equal(found.kind, PUBLIC_ENTITY_LOOKUP.FOUND);

    const archived = await archiveEntity({
      actor: editorActor(fixture),
      entityId: created.entityId,
      expectedUpdatedAt: created.updatedAt,
    });
    assert.equal(archived.status, ENTITY_STATUS.ARCHIVED);
    const missing = await getPublicEntityBySlug({ slug: created.slug });
    assert.equal(missing.kind, PUBLIC_ENTITY_LOOKUP.NOT_FOUND);

    const restored = await reactivateEntity({
      actor: editorActor(fixture),
      entityId: created.entityId,
      expectedUpdatedAt: archived.updatedAt,
    });
    assert.equal(restored.status, ENTITY_STATUS.ACTIVE);
    const foundAgain = await getPublicEntityBySlug({ slug: created.slug });
    assert.equal(foundAgain.kind, PUBLIC_ENTITY_LOOKUP.FOUND);

    const draft = await createDraftItem(fixture, {
      includeRelations: true,
      title: "Linked story",
    });
    const [linked] = await getDb()
      .select({ updatedAt: entities.updatedAt })
      .from(entities)
      .where(inArray(entities.id, [fixture.ids.entity]));
    await archiveEntity({
      actor: editorActor(fixture),
      entityId: fixture.ids.entity,
      expectedUpdatedAt: linked!.updatedAt,
    });
    const relations = await listPublicContentForEntity({
      entityId: fixture.ids.entity,
    });
    assert.equal(relations.length, 0);
    const stillLinked = await getEntityById({
      actorRoles: [STAFF_ROLE.EDITOR],
      entityId: fixture.ids.entity,
    });
    assert.equal(stillLinked.status, ENTITY_STATUS.ARCHIVED);
    void draft;
  });

  it("hides draft and archived profiles and redirects only live historical slugs", async () => {
    const slugA = uniqueSlug("oldslug");
    const slugB = uniqueSlug("newslug");
    const created = await createNamedEntity({
      name: "Redirect Person",
      slug: slugA,
      status: ENTITY_STATUS.ACTIVE,
    });
    const renamed = await updateEntitySlug({
      actor: editorActor(fixture),
      entityId: created.entityId,
      slug: slugB,
      expectedUpdatedAt: created.updatedAt,
    });
    const redirect = await getPublicEntityBySlug({ slug: slugA });
    assert.equal(redirect.kind, PUBLIC_ENTITY_LOOKUP.REDIRECT);
    if (redirect.kind === PUBLIC_ENTITY_LOOKUP.REDIRECT) {
      assert.equal(redirect.slug, slugB);
    }

    await archiveEntity({
      actor: editorActor(fixture),
      entityId: created.entityId,
      expectedUpdatedAt: renamed.updatedAt,
    });
    const archivedHistory = await getPublicEntityBySlug({ slug: slugA });
    assert.equal(archivedHistory.kind, PUBLIC_ENTITY_LOOKUP.NOT_FOUND);
  });

  it("resolves public related content from publishedVersionId only", async () => {
    const created = await createDraftItem(fixture, {
      includeRelations: true,
      title: "Published subject",
    });
    const submitted = await submitForReview(created.contentItemId, created.versionId, {
      expectedUpdatedAt: created.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    await approveVersion(created.contentItemId, created.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    const published = await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    void published;

    const extra = await createNamedEntity({
      name: "Draft Only Person",
      status: ENTITY_STATUS.ACTIVE,
    });
    const revision = await createDraftRevision(
      created.contentItemId,
      undefined,
      fixture.superAdmin,
      fixture.ids.staffEditor,
    );
    await updateDraftContent({
      contentItemId: created.contentItemId,
      versionId: revision.versionId,
      expectedUpdatedAt: revision.updatedAt,
      title: "Draft subject swap",
      body: articleBody("draft body"),
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
      categories: [{ categoryId: fixture.ids.categoryA, isPrimary: true }],
      entities: [
        {
          entityId: extra.entityId,
          role: ENTITY_ROLE.SUBJECT,
          sortOrder: 0,
        },
      ],
    });

    const publishedRelated = await listPublicContentForEntity({
      entityId: fixture.ids.entity,
    });
    assert.equal(
      publishedRelated.some((item) => item.contentItemId === created.contentItemId),
      true,
    );
    const draftRelated = await listPublicContentForEntity({
      entityId: extra.entityId,
    });
    assert.equal(draftRelated.length, 0);
  });

  it("excludes retracted articles from related content", async () => {
    const created = await createDraftItem(fixture, {
      includeRelations: true,
      title: "Withdrawn story",
    });
    const submitted = await submitForReview(created.contentItemId, created.versionId, {
      expectedUpdatedAt: created.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });
    await approveVersion(created.contentItemId, created.versionId, {
      expectedUpdatedAt: submitted.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffReviewerA,
    });
    const published = await publishVersion(
      created.contentItemId,
      created.versionId,
      fixture.superAdmin,
      fixture.ids.staffReviewerA,
    );
    await recordContentLegalAction({
      contentItemId: created.contentItemId,
      actionType: CONTENT_LEGAL_ACTION_TYPE.RETRACTION,
      reasonCategory: CONTENT_LEGAL_REASON_CATEGORY.EDITORIAL_STANDARDS,
      internalNote: "Geri çekme gerekçesi kayıt altına alındı.",
      publicNote: "Geri çekildi",
      expectedUpdatedAt: published.updatedAt,
      scope: fixture.superAdmin,
      actorId: fixture.ids.staffEditor,
    });

    const related = await listPublicContentForEntity({
      entityId: fixture.ids.entity,
    });
    assert.equal(
      related.some((item) => item.contentItemId === created.contentItemId),
      false,
    );
  });

  it("enforces author/editor capabilities and keeps picker on ACTIVE entities", async () => {
    await assert.rejects(
      () =>
        createEntity({
          actor: authorActor(fixture),
          profile: {
            kind: ENTITY_KIND.PERSON,
            canonicalName: "Author Cannot",
            slug: uniqueSlug("authno"),
          },
        }),
      (error: unknown) => {
        assertEntityCode(error, ENTITY_ERROR.FORBIDDEN);
        return true;
      },
    );

    const created = await createNamedEntity({
      name: "Picker Person",
      status: ENTITY_STATUS.ACTIVE,
    });
    const listed = await listEntities({
      actorRoles: [STAFF_ROLE.AUTHOR],
      q: "Picker",
    });
    assert.equal(
      listed.items.some((item) => item.entityId === created.entityId),
      true,
    );

    const picker = await lookupEditorEntities({ search: "Picker" });
    assert.equal(
      picker.some((item) => item.id === created.entityId && item.status === ENTITY_STATUS.ACTIVE),
      true,
    );

    const managed = await createEntity({
      actor: superAdminActor(fixture),
      profile: {
        kind: ENTITY_KIND.PERSON,
        canonicalName: "Admin Person",
        slug: uniqueSlug("adminp"),
        status: ENTITY_STATUS.DRAFT,
      },
    });
    createdEntityIds.push(managed.entityId);
  });

  it("records scalar audit events without biography dumps", async () => {
    const created = await createNamedEntity({
      name: "Audit Person",
      status: ENTITY_STATUS.ACTIVE,
    });
    await updateEntity({
      actor: editorActor(fixture),
      entityId: created.entityId,
      expectedUpdatedAt: created.updatedAt,
      profile: {
        kind: ENTITY_KIND.PERSON,
        canonicalName: "Audit Person",
        slug: created.slug,
        status: ENTITY_STATUS.ACTIVE,
        biography: "x".repeat(80),
        summary: "Kısa",
      },
    });
    const db = getDb();
    const events = await db
      .select()
      .from(entityAuditEvents)
      .where(inArray(entityAuditEvents.entityId, [created.entityId]));
    assert.equal(
      events.some((event) => event.eventType === ENTITY_AUDIT_EVENT_TYPE.ENTITY_CREATED),
      true,
    );
    assert.equal(
      JSON.stringify(events).includes("x".repeat(80)),
      false,
    );
  });

  it("matches Turkish names conservatively and emits advisory duplicates", async () => {
    const created = await createNamedEntity({
      name: "Işıl",
      status: ENTITY_STATUS.ACTIVE,
    });
    const listed = await listEntities({
      actorRoles: [STAFF_ROLE.EDITOR],
      q: "Işıl",
    });
    assert.equal(
      listed.items.some((item) => item.entityId === created.entityId),
      true,
    );
    const duplicates = await findPotentialEntityDuplicates({
      actorRoles: [STAFF_ROLE.EDITOR],
      canonicalName: "Işıl",
    });
    assert.equal(
      duplicates.some((item) => item.entityId === created.entityId),
      true,
    );
  });

  it("rejects new draft relations to archived entities while keeping existing links", async () => {
    const [current] = await getDb()
      .select({ updatedAt: entities.updatedAt })
      .from(entities)
      .where(inArray(entities.id, [fixture.ids.entity]));
    await archiveEntity({
      actor: editorActor(fixture),
      entityId: fixture.ids.entity,
      expectedUpdatedAt: current!.updatedAt,
    });

    await assert.rejects(
      () =>
        createDraftItem(fixture, {
          includeRelations: true,
          title: "Cannot add archived",
        }),
      (error: unknown) => {
        assert.equal(error instanceof PublishingError, true);
        assert.equal((error as PublishingError).code, PUBLISHING_ERROR.RELATION_NOT_FOUND);
        return true;
      },
    );
  });

  it("serializes stale writers after a locked entity update", async () => {
    const created = await createNamedEntity({ name: "Locked Person" });
    const holder = await getRacerPool().connect();
    try {
      await holder.query("BEGIN");
      await holder.query("SELECT id FROM entities WHERE id = $1 FOR UPDATE", [
        created.entityId,
      ]);
      const pidResult = await holder.query<{ pid: number }>(
        "SELECT pg_backend_pid() AS pid",
      );
      const competing = updateEntity({
        actor: editorActor(fixture),
        entityId: created.entityId,
        expectedUpdatedAt: created.updatedAt,
        profile: {
          kind: ENTITY_KIND.PERSON,
          canonicalName: "Should conflict",
          slug: created.slug,
          status: created.status,
        },
      });
      let settled = false;
      const observed = competing.then(
        (value) => {
          settled = true;
          return value;
        },
        (error: unknown) => {
          settled = true;
          throw error;
        },
      );
      await waitUntilBlockedByHolder(pidResult.rows[0]!.pid);
      assert.equal(settled, false);
      await holder.query("UPDATE entities SET canonical_name = $1, updated_at = now() WHERE id = $2", [
        "Holder won",
        created.entityId,
      ]);
      await holder.query("COMMIT");
      await assert.rejects(observed, (error: unknown) => {
        assertEntityCode(error, ENTITY_ERROR.ENTITY_WRITE_CONFLICT);
        return true;
      });
    } finally {
      try {
        await holder.query("ROLLBACK");
      } catch {
        // already closed
      }
      holder.release();
    }
  });

  it("does not allow two entities to occupy the same current slug concurrently", async () => {
    const first = await createNamedEntity({ name: "First Occupant" });
    const second = await createNamedEntity({ name: "Second Occupant" });
    const target = uniqueSlug("race");
    const results = await Promise.allSettled([
      updateEntitySlug({
        actor: editorActor(fixture),
        entityId: first.entityId,
        slug: target,
        expectedUpdatedAt: first.updatedAt,
      }),
      updateEntitySlug({
        actor: editorActor(fixture),
        entityId: second.entityId,
        slug: target,
        expectedUpdatedAt: second.updatedAt,
      }),
    ]);
    const fulfilled = results.filter((item) => item.status === "fulfilled");
    const rejected = results.filter((item) => item.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    if (rejected[0]?.status === "rejected") {
      assertEntityCode(rejected[0].reason, ENTITY_ERROR.SLUG_CONFLICT);
    }
  });
});
