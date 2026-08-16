import { eq, inArray } from "drizzle-orm";
import {
  PUBLISHING_ERROR,
  PublishingError,
  type AuthorRole,
  type EntityRole,
  type MediaRole,
} from "@magazine/domain";
import { authors } from "../schema/authors";
import {
  contentVersionAuthors,
  contentVersionCategories,
  contentVersionEntities,
  contentVersionMedia,
  contentVersionTags,
} from "../schema/content";
import { entities } from "../schema/entities";
import { media } from "../schema/media";
import { categories, tags } from "../schema/taxonomy";
import type { PublishingTx } from "./db-types";

export type ContentRelationInput = {
  categories?: readonly { categoryId: string; isPrimary: boolean }[];
  tags?: readonly { tagId: string }[];
  entities?: readonly {
    entityId: string;
    role: EntityRole;
    sortOrder?: number;
  }[];
  media?: readonly {
    mediaId: string;
    role: MediaRole;
    sortOrder?: number;
    caption?: string | null;
    altText?: string | null;
    credit?: string | null;
  }[];
  authors?: readonly {
    authorId: string;
    role: AuthorRole;
    sortOrder?: number;
  }[];
};

async function assertIdsExist(
  tx: PublishingTx,
  table: typeof categories | typeof tags | typeof entities | typeof media | typeof authors,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const uniqueIds = [...new Set(ids)];
  const rows = await tx
    .select({ id: table.id })
    .from(table)
    .where(inArray(table.id, uniqueIds));

  if (rows.length !== uniqueIds.length) {
    throw new PublishingError(PUBLISHING_ERROR.RELATION_NOT_FOUND);
  }
}

export async function assertRelatedRecordsExist(
  tx: PublishingTx,
  input: ContentRelationInput,
): Promise<void> {
  await assertIdsExist(
    tx,
    categories,
    (input.categories ?? []).map((item) => item.categoryId),
  );
  await assertIdsExist(
    tx,
    tags,
    (input.tags ?? []).map((item) => item.tagId),
  );
  await assertIdsExist(
    tx,
    entities,
    (input.entities ?? []).map((item) => item.entityId),
  );
  await assertIdsExist(
    tx,
    media,
    (input.media ?? []).map((item) => item.mediaId),
  );
  await assertIdsExist(
    tx,
    authors,
    (input.authors ?? []).map((item) => item.authorId),
  );
}

export async function insertVersionRelations(
  tx: PublishingTx,
  contentVersionId: string,
  input: ContentRelationInput,
): Promise<void> {
  if (input.categories && input.categories.length > 0) {
    await tx.insert(contentVersionCategories).values(
      input.categories.map((item) => ({
        contentVersionId,
        categoryId: item.categoryId,
        isPrimary: item.isPrimary,
      })),
    );
  }

  if (input.tags && input.tags.length > 0) {
    await tx.insert(contentVersionTags).values(
      input.tags.map((item) => ({
        contentVersionId,
        tagId: item.tagId,
      })),
    );
  }

  if (input.entities && input.entities.length > 0) {
    await tx.insert(contentVersionEntities).values(
      input.entities.map((item) => ({
        contentVersionId,
        entityId: item.entityId,
        role: item.role,
        sortOrder: item.sortOrder ?? 0,
      })),
    );
  }

  if (input.media && input.media.length > 0) {
    await tx.insert(contentVersionMedia).values(
      input.media.map((item) => ({
        contentVersionId,
        mediaId: item.mediaId,
        role: item.role,
        sortOrder: item.sortOrder ?? 0,
        caption: item.caption ?? null,
        altText: item.altText ?? null,
        credit: item.credit ?? null,
      })),
    );
  }

  if (input.authors && input.authors.length > 0) {
    await tx.insert(contentVersionAuthors).values(
      input.authors.map((item) => ({
        contentVersionId,
        authorId: item.authorId,
        role: item.role,
        sortOrder: item.sortOrder ?? 0,
      })),
    );
  }
}

export async function loadVersionRelations(
  tx: PublishingTx,
  contentVersionId: string,
): Promise<ContentRelationInput> {
  const [categoryRows, tagRows, entityRows, mediaRows, authorRows] =
    await Promise.all([
      tx
        .select()
        .from(contentVersionCategories)
        .where(eqCategory(contentVersionId)),
      tx.select().from(contentVersionTags).where(eqTag(contentVersionId)),
      tx
        .select()
        .from(contentVersionEntities)
        .where(eqEntity(contentVersionId)),
      tx.select().from(contentVersionMedia).where(eqMedia(contentVersionId)),
      tx
        .select()
        .from(contentVersionAuthors)
        .where(eqAuthor(contentVersionId)),
    ]);

  return {
    categories: categoryRows.map((row) => ({
      categoryId: row.categoryId,
      isPrimary: row.isPrimary,
    })),
    tags: tagRows.map((row) => ({ tagId: row.tagId })),
    entities: entityRows.map((row) => ({
      entityId: row.entityId,
      role: row.role,
      sortOrder: row.sortOrder,
    })),
    media: mediaRows.map((row) => ({
      mediaId: row.mediaId,
      role: row.role,
      sortOrder: row.sortOrder,
      caption: row.caption,
      altText: row.altText,
      credit: row.credit,
    })),
    authors: authorRows.map((row) => ({
      authorId: row.authorId,
      role: row.role,
      sortOrder: row.sortOrder,
    })),
  };
}

function eqCategory(contentVersionId: string) {
  return eq(contentVersionCategories.contentVersionId, contentVersionId);
}

function eqTag(contentVersionId: string) {
  return eq(contentVersionTags.contentVersionId, contentVersionId);
}

function eqEntity(contentVersionId: string) {
  return eq(contentVersionEntities.contentVersionId, contentVersionId);
}

function eqMedia(contentVersionId: string) {
  return eq(contentVersionMedia.contentVersionId, contentVersionId);
}

function eqAuthor(contentVersionId: string) {
  return eq(contentVersionAuthors.contentVersionId, contentVersionId);
}
