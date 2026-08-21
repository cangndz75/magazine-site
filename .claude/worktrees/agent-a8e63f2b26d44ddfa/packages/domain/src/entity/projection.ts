import type { PublicMediaProjection } from "../media-rights";
import {
  ENTITY_KIND_JSON_LD_TYPE,
  type CanonicalEntityProfile,
  type EntityJsonLdType,
  type EntityKind,
} from "./types";

export type PublicEntityPortrait = Pick<
  PublicMediaProjection,
  "url" | "width" | "height" | "altText" | "credit"
>;

export type PublicEntityProjection = {
  entityId: string;
  kind: EntityKind;
  canonicalName: string;
  slug: string;
  summary: string | null;
  biography: string | null;
  occupation: string | null;
  birthDate: string | null;
  officialWebsiteUrl: string | null;
  alternateNames: string[];
  portrait: PublicEntityPortrait | null;
};

export type EditorEntityProjection = {
  entityId: string;
  kind: EntityKind;
  canonicalName: string;
  slug: string;
  status: CanonicalEntityProfile["status"];
  summary: string | null;
  biography: string | null;
  portraitMediaId: string | null;
  birthDate: string | null;
  occupation: string | null;
  officialWebsiteUrl: string | null;
  aliases: { aliasId: string; display: string; searchKey: string }[];
  mergedIntoEntityId: string | null;
  deletedAt: Date | null;
  updatedAt: Date;
};

export function toPublicEntityPortrait(
  input: PublicMediaProjection | null,
): PublicEntityPortrait | null {
  if (input === null || input.url === null) {
    return null;
  }
  return {
    url: input.url,
    width: input.width,
    height: input.height,
    altText: input.altText,
    credit: input.credit,
  };
}

export function toPublicEntityProjection(input: {
  entityId: string;
  kind: EntityKind;
  canonicalName: string;
  slug: string;
  summary: string | null;
  biography: string | null;
  occupation: string | null;
  birthDate: string | null;
  officialWebsiteUrl: string | null;
  aliases: readonly { display: string }[];
  portrait: PublicEntityPortrait | null;
}): PublicEntityProjection {
  return {
    entityId: input.entityId,
    kind: input.kind,
    canonicalName: input.canonicalName,
    slug: input.slug,
    summary: input.summary,
    biography: input.biography,
    occupation: input.occupation,
    birthDate: input.birthDate,
    officialWebsiteUrl: input.officialWebsiteUrl,
    alternateNames: input.aliases.map((alias) => alias.display),
    portrait: input.portrait,
  };
}

export function toEditorEntityProjection(
  profile: CanonicalEntityProfile,
): EditorEntityProjection {
  return {
    entityId: profile.entityId,
    kind: profile.kind,
    canonicalName: profile.canonicalName,
    slug: profile.slug,
    status: profile.status,
    summary: profile.summary,
    biography: profile.biography,
    portraitMediaId: profile.portraitMediaId,
    birthDate: profile.birthDate,
    occupation: profile.occupation,
    officialWebsiteUrl: profile.officialWebsiteUrl,
    aliases: profile.aliases.map((alias) => ({
      aliasId: alias.aliasId,
      display: alias.display,
      searchKey: alias.searchKey,
    })),
    mergedIntoEntityId: profile.mergedIntoEntityId,
    deletedAt: profile.deletedAt,
    updatedAt: profile.updatedAt,
  };
}

export function entityJsonLdType(kind: EntityKind): EntityJsonLdType {
  return ENTITY_KIND_JSON_LD_TYPE[kind];
}

/**
 * Future JSON-LD may emit only these configured editorial fields.
 * spouse, birthPlace, jobTitle, and scraped sameAs are never invented.
 */
export type PublicEntitySeoInput = {
  name: string;
  url: string;
  description: string | null;
  image: string | null;
  sameAs: string | null;
  birthDate: string | null;
  jobTitle: string | null;
};

export function toPublicEntitySeoInput(input: {
  canonicalName: string;
  canonicalUrl: string;
  summary: string | null;
  portraitUrl: string | null;
  officialWebsiteUrl: string | null;
  birthDate: string | null;
  occupation: string | null;
}): PublicEntitySeoInput {
  return {
    name: input.canonicalName,
    url: input.canonicalUrl,
    description: input.summary,
    image: input.portraitUrl,
    sameAs: input.officialWebsiteUrl,
    birthDate: input.birthDate,
    jobTitle: input.occupation,
  };
}

export const PUBLIC_ENTITY_PROJECTION_KEYS = [
  "entityId",
  "kind",
  "canonicalName",
  "slug",
  "summary",
  "biography",
  "occupation",
  "birthDate",
  "officialWebsiteUrl",
  "alternateNames",
  "portrait",
] as const satisfies readonly (keyof PublicEntityProjection)[];
