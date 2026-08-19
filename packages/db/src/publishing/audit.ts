import {
  CONTENT_AUDIT_ACTOR_KIND,
  CONTENT_AUDIT_EVENT_TYPE,
  assertContentAuditChangeSet,
  type ContentAuditActor,
  type ContentAuditChangeSet,
  type ContentAuditEventType,
  type ContentAuditRelationSummary,
  type ContentAuditScalarInput,
  diffAuditScalarFields,
} from "@magazine/domain";
import { contentAuditEvents } from "../schema/audit-events";
import type { PublishingTx } from "./db-types";
import { runBeforeAuditEventInserted } from "./test-hooks";
import type { ContentRelationInput } from "./relations";
import type { ContentVideoRelationInput } from "./draft-video";

export type AuditActorInput = ContentAuditActor;

export const SYSTEM_AUDIT_ACTOR: AuditActorInput = {
  kind: CONTENT_AUDIT_ACTOR_KIND.SYSTEM,
};

export function staffAuditActor(staffUserId: string): AuditActorInput {
  return { kind: CONTENT_AUDIT_ACTOR_KIND.STAFF, staffUserId };
}

export async function appendContentAuditEvent(
  tx: PublishingTx,
  input: {
    contentItemId: string;
    versionId: string | null;
    eventType: ContentAuditEventType;
    actor: AuditActorInput;
    changeSet?: ContentAuditChangeSet | null;
  },
): Promise<void> {
  const changeSet = assertContentAuditChangeSet(input.changeSet ?? null);
  await runBeforeAuditEventInserted({
    contentItemId: input.contentItemId,
    versionId: input.versionId,
    eventType: input.eventType,
  });

  await tx.insert(contentAuditEvents).values({
    contentItemId: input.contentItemId,
    contentVersionId: input.versionId,
    eventType: input.eventType,
    actorKind: input.actor.kind,
    actorStaffUserId:
      input.actor.kind === CONTENT_AUDIT_ACTOR_KIND.STAFF
        ? input.actor.staffUserId
        : null,
    changeSet,
  });
}

export function draftScalarInput(row: {
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robots: string | null;
  credibility: string | null;
  credibilitySource: string | null;
  source: string | null;
  sourceOrganization: string | null;
  sourceUrl: string | null;
  syndicated: boolean;
  isMaterialUpdate: boolean;
}): ContentAuditScalarInput {
  return {
    title: row.title,
    subtitle: row.subtitle,
    excerpt: row.excerpt,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonicalUrl: row.canonicalUrl,
    robots: row.robots,
    credibility: row.credibility,
    credibilitySource: row.credibilitySource,
    source: row.source,
    sourceOrganization: row.sourceOrganization,
    sourceUrl: row.sourceUrl,
    syndicated: row.syndicated,
    isMaterialUpdate: row.isMaterialUpdate,
  };
}

export function buildDraftUpdateChangeSet(input: {
  before: Parameters<typeof draftScalarInput>[0];
  after: Parameters<typeof draftScalarInput>[0];
  bodyChanged?: boolean;
  beforeRelations?: ContentRelationInput;
  afterRelations?: ContentRelationInput;
  beforeVideos?: readonly ContentVideoRelationInput[];
  afterVideos?: readonly ContentVideoRelationInput[];
}): ContentAuditChangeSet | null {
  const scalarChanges = diffAuditScalarFields(
    draftScalarInput(input.before),
    draftScalarInput(input.after),
  );
  const relationChanges =
    input.beforeRelations && input.afterRelations
      ? relationSummaries(input.beforeRelations, input.afterRelations)
      : [];
  const videoRelationChange =
    input.beforeVideos && input.afterVideos
      ? relationSummary("videos", input.beforeVideos, input.afterVideos)
      : null;
  if (videoRelationChange?.changed) {
    relationChanges.push(videoRelationChange);
  }
  const bodyChange = input.bodyChanged
    ? { changed: true, detailLimited: true }
    : undefined;
  const detailLimited = Boolean(bodyChange);

  if (
    scalarChanges.length === 0 &&
    relationChanges.length === 0 &&
    !bodyChange
  ) {
    return null;
  }

  return {
    ...(scalarChanges.length > 0 ? { scalarChanges } : {}),
    ...(bodyChange ? { bodyChange } : {}),
    ...(relationChanges.length > 0 ? { relationChanges } : {}),
    ...(detailLimited ? { detailLimited } : {}),
  };
}

function relationSummaries(
  before: ContentRelationInput,
  after: ContentRelationInput,
): ContentAuditRelationSummary[] {
  return [
    relationSummary("categories", before.categories ?? [], after.categories ?? []),
    relationSummary("tags", before.tags ?? [], after.tags ?? []),
    relationSummary("entities", before.entities ?? [], after.entities ?? []),
    relationSummary("media", before.media ?? [], after.media ?? []),
    relationSummary("authors", before.authors ?? [], after.authors ?? []),
  ].filter((item) => item.changed);
}

function relationSummary(
  relation: ContentAuditRelationSummary["relation"],
  before: readonly unknown[],
  after: readonly unknown[],
): ContentAuditRelationSummary {
  return {
    relation,
    beforeCount: before.length,
    afterCount: after.length,
    changed: JSON.stringify(before) !== JSON.stringify(after),
    detailLimited: true,
  };
}

export const AUDIT_EVENT = CONTENT_AUDIT_EVENT_TYPE;
