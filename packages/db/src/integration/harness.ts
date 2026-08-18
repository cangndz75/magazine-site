import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Client, Pool } from "pg";
import {
  AUTHOR_ROLE,
  ENTITY_KIND,
  ENTITY_ROLE,
  MEDIA_ROLE,
  MEDIA_TYPE,
  STAFF_ROLE,
  STAFF_SCOPE_MODE,
  STAFF_STATUS,
  editorTimestampToEpochMs,
  type EditorStaffScope,
} from "@magazine/domain";
import { closeDb, getDb } from "../client";
import {
  createContent,
  getContentItem,
  getContentVersion,
} from "../publishing";
import { loadVersionRelations } from "../publishing/relations";
import {
  authors,
  categories,
  contentItems,
  entities,
  media,
  staffUsers,
  tags,
} from "../schema";
import { eq } from "drizzle-orm";
import {
  bindEditorContentTestDatabaseUrl,
  type SafeTestDatabaseUrl,
} from "./env";
import { ensureJournaledTestSchema } from "./schema";

export type IntegrationFixture = {
  ids: {
    categoryA: string;
    categoryB: string;
    tag: string;
    extraTag: string;
    entity: string;
    media: string;
    extraMedia: string;
    author: string;
    extraAuthor: string;
    staffEditor: string;
    staffReviewerA: string;
    staffReviewerB: string;
  };
  selectedOnA: EditorStaffScope;
  selectedOnB: EditorStaffScope;
  superAdmin: EditorStaffScope;
  createdItemIds: string[];
};

export type ContentSnapshot = {
  updatedAtMs: number;
  publicationStatus: string;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  scheduledVersionId: string | null;
  scheduledAtMs: number | null;
  scheduleGeneration: number;
  title: string;
  body: unknown;
  workflowStatus: string;
  categories: { categoryId: string; isPrimary: boolean }[];
  tags: { tagId: string }[];
  entities: { entityId: string; role: string; sortOrder: number }[];
  media: {
    mediaId: string;
    role: string;
    sortOrder: number;
    caption: string | null;
    altText: string | null;
    credit: string | null;
  }[];
  authors: { authorId: string; role: string; sortOrder: number }[];
};

const EMPTY_BODY = { blocks: [{ type: "paragraph", text: "original" }] };
const ACTOR_A_BODY = { blocks: [{ type: "paragraph", text: "actor-a" }] };
const ACTOR_B_BODY = { blocks: [{ type: "paragraph", text: "actor-b" }] };

let bound: SafeTestDatabaseUrl | undefined;
let racerPool: Pool | undefined;

export function uniqueSlug(prefix: string): string {
  return `${prefix}${randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

export function superAdminScope(): EditorStaffScope {
  return {
    roles: [STAFF_ROLE.SUPER_ADMIN],
    scopeMode: STAFF_SCOPE_MODE.ALL,
    scopedCategoryIds: [],
  };
}

export function selectedEditorScope(
  categoryIds: readonly string[],
): EditorStaffScope {
  return {
    roles: [STAFF_ROLE.EDITOR],
    scopeMode: STAFF_SCOPE_MODE.SELECTED,
    scopedCategoryIds: categoryIds,
  };
}

export function articleBody(text: string): Record<string, unknown> {
  return { blocks: [{ type: "paragraph", text }] };
}

export const BODIES = {
  empty: EMPTY_BODY,
  actorA: ACTOR_A_BODY,
  actorB: ACTOR_B_BODY,
};

export function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export async function ensureEditorContentTestDatabase(): Promise<SafeTestDatabaseUrl> {
  if (bound) {
    return bound;
  }

  bound = bindEditorContentTestDatabaseUrl(process.env);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "magazine_editor_content_itest_setup",
  });
  await client.connect();
  try {
    await ensureJournaledTestSchema(client);
  } finally {
    await client.end();
  }

  return bound;
}

export function getRacerPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("Test database URL is not bound.");
  }

  if (!racerPool) {
    racerPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      application_name: "magazine_editor_content_itest_racer",
      max: 4,
    });
  }

  return racerPool;
}

export async function closeIntegrationConnections(): Promise<void> {
  await closeDb();
  if (racerPool) {
    await racerPool.end();
    racerPool = undefined;
  }
}

export async function createFixture(): Promise<IntegrationFixture> {
  const db = getDb();
  const ids = {
    categoryA: randomUUID(),
    categoryB: randomUUID(),
    tag: randomUUID(),
    extraTag: randomUUID(),
    entity: randomUUID(),
    media: randomUUID(),
    extraMedia: randomUUID(),
    author: randomUUID(),
    extraAuthor: randomUUID(),
    staffEditor: randomUUID(),
    staffReviewerA: randomUUID(),
    staffReviewerB: randomUUID(),
  };

  await db.insert(categories).values([
    {
      id: ids.categoryA,
      name: "Category A",
      slug: uniqueSlug("cata"),
    },
    {
      id: ids.categoryB,
      name: "Category B",
      slug: uniqueSlug("catb"),
    },
  ]);
  await db.insert(tags).values([
    { id: ids.tag, name: "Tag One", slug: uniqueSlug("tag") },
    { id: ids.extraTag, name: "Tag Two", slug: uniqueSlug("tagx") },
  ]);
  await db.insert(entities).values({
    id: ids.entity,
    kind: ENTITY_KIND.PERSON,
    canonicalName: "Entity One",
    slug: uniqueSlug("ent"),
  });
  await db.insert(media).values([
    {
      id: ids.media,
      storageKey: `itest/${ids.media}`,
      mediaType: MEDIA_TYPE.IMAGE,
      mimeType: "image/jpeg",
      byteSize: 1024,
    },
    {
      id: ids.extraMedia,
      storageKey: `itest/${ids.extraMedia}`,
      mediaType: MEDIA_TYPE.IMAGE,
      mimeType: "image/jpeg",
      byteSize: 2048,
    },
  ]);
  await db.insert(authors).values([
    {
      id: ids.author,
      displayName: "Author One",
      slug: uniqueSlug("auth"),
    },
    {
      id: ids.extraAuthor,
      displayName: "Author Two",
      slug: uniqueSlug("authx"),
    },
  ]);
  await db.insert(staffUsers).values([
    {
      id: ids.staffEditor,
      email: `editor-${ids.staffEditor.slice(0, 8)}@itest.local`,
      displayName: "Itest Editor",
      status: STAFF_STATUS.ACTIVE,
      scopeMode: STAFF_SCOPE_MODE.ALL,
    },
    {
      id: ids.staffReviewerA,
      email: `reviewer-a-${ids.staffReviewerA.slice(0, 8)}@itest.local`,
      displayName: "Itest Reviewer A",
      status: STAFF_STATUS.ACTIVE,
      scopeMode: STAFF_SCOPE_MODE.ALL,
    },
    {
      id: ids.staffReviewerB,
      email: `reviewer-b-${ids.staffReviewerB.slice(0, 8)}@itest.local`,
      displayName: "Itest Reviewer B",
      status: STAFF_STATUS.ACTIVE,
      scopeMode: STAFF_SCOPE_MODE.ALL,
    },
  ]);

  return {
    ids,
    selectedOnA: selectedEditorScope([ids.categoryA]),
    selectedOnB: selectedEditorScope([ids.categoryB]),
    superAdmin: superAdminScope(),
    createdItemIds: [],
  };
}

export async function createDraftItem(
  fixture: IntegrationFixture,
  input: {
    scope?: EditorStaffScope;
    title?: string;
    body?: unknown;
    categories?: { categoryId: string; isPrimary: boolean }[];
    tags?: { tagId: string }[];
    includeRelations?: boolean;
    actorId?: string;
  } = {},
) {
  const created = await createContent({
    slug: uniqueSlug("item"),
    title: input.title ?? "Original title",
    body: input.body ?? EMPTY_BODY,
    scope: input.scope ?? fixture.selectedOnA,
    actorId: input.actorId ?? fixture.ids.staffEditor,
    categories: input.categories ?? [
      { categoryId: fixture.ids.categoryA, isPrimary: true },
    ],
    tags: input.tags ?? (input.includeRelations ? [{ tagId: fixture.ids.tag }] : []),
    entities: input.includeRelations
      ? [
          {
            entityId: fixture.ids.entity,
            role: ENTITY_ROLE.SUBJECT,
            sortOrder: 0,
          },
        ]
      : [],
    media: input.includeRelations
      ? [
          {
            mediaId: fixture.ids.media,
            role: MEDIA_ROLE.HERO,
            sortOrder: 0,
            caption: "cap",
            altText: "alt",
            credit: "cred",
          },
        ]
      : [],
    authors: input.includeRelations
      ? [
          {
            authorId: fixture.ids.author,
            role: AUTHOR_ROLE.AUTHOR,
            sortOrder: 0,
          },
        ]
      : [],
  });

  fixture.createdItemIds.push(created.contentItemId);
  return created;
}

export async function snapshotContent(
  contentItemId: string,
  versionId: string,
): Promise<ContentSnapshot> {
  const item = await getContentItem(contentItemId);
  const version = await getContentVersion(versionId);
  const db = getDb();
  const relations = await db.transaction((tx) =>
    loadVersionRelations(tx, versionId),
  );

  return {
    updatedAtMs: requiredTimestampMs(item.updatedAt),
    publicationStatus: item.publicationStatus,
    publishedVersionId: item.publishedVersionId,
    draftVersionId: item.draftVersionId,
    scheduledVersionId: item.scheduledVersionId,
    scheduledAtMs: item.scheduledAt
      ? requiredTimestampMs(item.scheduledAt)
      : null,
    scheduleGeneration: item.scheduleGeneration,
    title: version.title,
    body: version.body,
    workflowStatus: version.workflowStatus,
    categories: [...(relations.categories ?? [])].sort((a, b) =>
      a.categoryId.localeCompare(b.categoryId),
    ),
    tags: [...(relations.tags ?? [])].sort((a, b) =>
      a.tagId.localeCompare(b.tagId),
    ),
    entities: [...(relations.entities ?? [])]
      .map((item) => ({
        entityId: item.entityId,
        role: item.role,
        sortOrder: item.sortOrder ?? 0,
      }))
      .sort((a, b) => a.entityId.localeCompare(b.entityId)),
    media: [...(relations.media ?? [])]
      .map((item) => ({
        mediaId: item.mediaId,
        role: item.role,
        sortOrder: item.sortOrder ?? 0,
        caption: item.caption ?? null,
        altText: item.altText ?? null,
        credit: item.credit ?? null,
      }))
      .sort((a, b) => a.mediaId.localeCompare(b.mediaId)),
    authors: [...(relations.authors ?? [])]
      .map((item) => ({
        authorId: item.authorId,
        role: item.role,
        sortOrder: item.sortOrder ?? 0,
      }))
      .sort((a, b) => a.authorId.localeCompare(b.authorId)),
  };
}

export function requiredTimestampMs(value: Date | string): number {
  const ms = editorTimestampToEpochMs(value);
  if (ms === null) {
    throw new Error("Timestamp is not a valid Date.");
  }
  return ms;
}

export async function persistUpdatedAtMs(
  contentItemId: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ updatedAt: contentItems.updatedAt })
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId))
    .limit(1);

  if (!row) {
    throw new Error("content_items row missing after write.");
  }

  return requiredTimestampMs(row.updatedAt);
}

export async function replaceVersionCategoriesDirect(
  contentVersionId: string,
  categoryId: string,
): Promise<void> {
  const client = await getRacerPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM content_version_categories WHERE content_version_id = $1",
      [contentVersionId],
    );
    await client.query(
      `INSERT INTO content_version_categories (
         content_version_id, category_id, is_primary
       ) VALUES ($1, $2, true)`,
      [contentVersionId, categoryId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function waitUntilBlockedByHolder(
  holderPid: number,
  timeoutMs = 8000,
): Promise<number> {
  const started = Date.now();
  const observer = getRacerPool();

  while (Date.now() - started < timeoutMs) {
    const result = await observer.query<{ blocked_pid: number }>(
      `SELECT blocked.pid AS blocked_pid
       FROM pg_locks blocked
       JOIN pg_locks holder
         ON holder.locktype = blocked.locktype
        AND holder.database IS NOT DISTINCT FROM blocked.database
        AND holder.relation IS NOT DISTINCT FROM blocked.relation
        AND holder.page IS NOT DISTINCT FROM blocked.page
        AND holder.tuple IS NOT DISTINCT FROM blocked.tuple
        AND holder.virtualxid IS NOT DISTINCT FROM blocked.virtualxid
        AND holder.transactionid IS NOT DISTINCT FROM blocked.transactionid
        AND holder.classid IS NOT DISTINCT FROM blocked.classid
        AND holder.objid IS NOT DISTINCT FROM blocked.objid
        AND holder.objsubid IS NOT DISTINCT FROM blocked.objsubid
        AND holder.pid IS DISTINCT FROM blocked.pid
       WHERE NOT blocked.granted
         AND holder.granted
         AND holder.pid = $1`,
      [holderPid],
    );
    const blockedPid = result.rows[0]?.blocked_pid;
    if (blockedPid) {
      return blockedPid;
    }
    await delay(5);
  }

  throw new Error(
    `Timed out waiting for a PostgreSQL session to block on holder pid ${holderPid}.`,
  );
}

export async function countOpenTestTransactions(): Promise<number> {
  const result = await getRacerPool().query<{ count: string }>(
    `SELECT count(*)::text AS count
     FROM pg_stat_activity
     WHERE datname = current_database()
       AND xact_start IS NOT NULL
       AND pid <> pg_backend_pid()
       AND application_name LIKE 'magazine_editor_content_itest%'`,
  );
  return Number(result.rows[0]?.count ?? "0");
}

export async function countLeftoverFixtures(
  itemIds: readonly string[],
): Promise<{
  items: number;
  versions: number;
  reviewEvents: number;
  auditEvents: number;
  outboxEvents: number;
}> {
  if (itemIds.length === 0) {
    return {
      items: 0,
      versions: 0,
      reviewEvents: 0,
      auditEvents: 0,
      outboxEvents: 0,
    };
  }

  const result = await getRacerPool().query<{
    items: string;
    versions: string;
    reviewEvents: string;
    auditEvents: string;
    outboxEvents: string;
  }>(
    `SELECT
       (SELECT count(*)::text FROM content_items WHERE id = ANY($1::uuid[])) AS items,
       (SELECT count(*)::text FROM content_versions WHERE content_item_id = ANY($1::uuid[])) AS versions,
       (SELECT count(*)::text FROM content_review_events WHERE content_item_id = ANY($1::uuid[])) AS "reviewEvents",
       (SELECT count(*)::text FROM content_audit_events WHERE content_item_id = ANY($1::uuid[])) AS "auditEvents",
       (SELECT count(*)::text FROM public_cache_outbox WHERE (payload->>'contentItemId')::uuid = ANY($1::uuid[])) AS "outboxEvents"`,
    [itemIds],
  );

  return {
    items: Number(result.rows[0]?.items ?? "0"),
    versions: Number(result.rows[0]?.versions ?? "0"),
    reviewEvents: Number(result.rows[0]?.reviewEvents ?? "0"),
    auditEvents: Number(result.rows[0]?.auditEvents ?? "0"),
    outboxEvents: Number(result.rows[0]?.outboxEvents ?? "0"),
  };
}

export async function cleanupFixture(fixture: IntegrationFixture): Promise<void> {
  const pool = getRacerPool();
  const itemIds = fixture.createdItemIds;

  if (itemIds.length > 0) {
    await pool.query(
      `UPDATE content_items
       SET publication_status = 'UNPUBLISHED',
           published_version_id = NULL,
           draft_version_id = NULL,
           scheduled_version_id = NULL,
           scheduled_at = NULL
       WHERE id = ANY($1::uuid[])`,
      [itemIds],
    );
    await pool.query(
      "DELETE FROM content_review_events WHERE content_item_id = ANY($1::uuid[])",
      [itemIds],
    );
    await pool.query(
      "DELETE FROM content_audit_events WHERE content_item_id = ANY($1::uuid[])",
      [itemIds],
    );
    await pool.query(
      "DELETE FROM public_cache_outbox WHERE (payload->>'contentItemId')::uuid = ANY($1::uuid[])",
      [itemIds],
    );
    await pool.query(
      "DELETE FROM content_versions WHERE content_item_id = ANY($1::uuid[])",
      [itemIds],
    );
    await pool.query("DELETE FROM content_items WHERE id = ANY($1::uuid[])", [
      itemIds,
    ]);
  }

  await pool.query(
    "DELETE FROM content_review_events WHERE actor_id = ANY($1::uuid[])",
    [[fixture.ids.staffEditor, fixture.ids.staffReviewerA, fixture.ids.staffReviewerB]],
  );

  await pool.query("DELETE FROM content_version_tags WHERE tag_id = ANY($1::uuid[])", [
    [fixture.ids.tag, fixture.ids.extraTag],
  ]);
  await pool.query(
    "DELETE FROM content_version_entities WHERE entity_id = $1",
    [fixture.ids.entity],
  );
  await pool.query("DELETE FROM content_version_media WHERE media_id = ANY($1::uuid[])", [
    [fixture.ids.media, fixture.ids.extraMedia],
  ]);
  await pool.query(
    "DELETE FROM content_version_authors WHERE author_id = ANY($1::uuid[])",
    [[fixture.ids.author, fixture.ids.extraAuthor]],
  );
  await pool.query(
    "DELETE FROM content_version_categories WHERE category_id = ANY($1::uuid[])",
    [[fixture.ids.categoryA, fixture.ids.categoryB]],
  );
  await pool.query("DELETE FROM tags WHERE id = ANY($1::uuid[])", [
    [fixture.ids.tag, fixture.ids.extraTag],
  ]);
  await pool.query("DELETE FROM entities WHERE id = $1", [fixture.ids.entity]);
  await pool.query("DELETE FROM media WHERE id = ANY($1::uuid[])", [
    [fixture.ids.media, fixture.ids.extraMedia],
  ]);
  await pool.query("DELETE FROM authors WHERE id = ANY($1::uuid[])", [
    [fixture.ids.author, fixture.ids.extraAuthor],
  ]);
  await pool.query("DELETE FROM categories WHERE id = ANY($1::uuid[])", [
    [fixture.ids.categoryA, fixture.ids.categoryB],
  ]);
  await pool.query("DELETE FROM staff_users WHERE id = ANY($1::uuid[])", [
    [
      fixture.ids.staffEditor,
      fixture.ids.staffReviewerA,
      fixture.ids.staffReviewerB,
    ],
  ]);
}

export function primaryA(
  fixture: IntegrationFixture,
): { categoryId: string; isPrimary: boolean }[] {
  return [{ categoryId: fixture.ids.categoryA, isPrimary: true }];
}

export function primaryASecondaryB(
  fixture: IntegrationFixture,
): { categoryId: string; isPrimary: boolean }[] {
  return [
    { categoryId: fixture.ids.categoryA, isPrimary: true },
    { categoryId: fixture.ids.categoryB, isPrimary: false },
  ];
}
