import type { Metadata } from "next";
import {
  buildEntityProfileJsonLd,
  resolvePublicMetadataDescription,
  serializeEntityProfileJsonLd,
  toPublicEntitySeoInput,
  type EntityKind,
} from "@magazine/domain";
import type { PublicEntityPage } from "@magazine/db/entities";
import { publicEntityCanonicalUrl } from "./public-site-url";

export type PublicEntitySeo = {
  metadata: Metadata;
  jsonLd: Record<string, unknown> | null;
  jsonLdScript: string | null;
};

const NOT_FOUND_TITLE = "Profil bulunamadı";
const NOT_FOUND_DESCRIPTION =
  "Bu profil yayında değil veya böyle bir adres yok.";

export const PUBLIC_ENTITY_KIND_LABELS: Record<EntityKind, string> = {
  PERSON: "Kişi",
  ORGANIZATION: "Kuruluş",
  BRAND: "Marka",
  PRODUCTION: "Yapım",
  PLACE: "Mekân",
  EVENT: "Etkinlik",
};

function optionalText(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function publicEntityKindLabel(kind: EntityKind): string {
  return PUBLIC_ENTITY_KIND_LABELS[kind];
}

export function buildNotFoundEntityMetadata(): Metadata {
  return {
    title: NOT_FOUND_TITLE,
    description: NOT_FOUND_DESCRIPTION,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export function buildPublicEntityPageSeo(
  page: PublicEntityPage | null,
  siteUrl: string,
): PublicEntitySeo {
  if (!page || page.status !== "found") {
    return {
      metadata: buildNotFoundEntityMetadata(),
      jsonLd: null,
      jsonLdScript: null,
    };
  }

  const { entity } = page;
  const canonicalUrl = publicEntityCanonicalUrl(siteUrl, entity.slug);
  const title = entity.canonicalName;
  const description =
    resolvePublicMetadataDescription({
      seoDescription: null,
      excerpt: entity.summary,
      subtitle: null,
    }) ?? undefined;
  const seoInput = toPublicEntitySeoInput({
    canonicalName: entity.canonicalName,
    canonicalUrl,
    summary: entity.summary,
    portraitUrl: entity.portrait?.url ?? null,
    officialWebsiteUrl: entity.officialWebsiteUrl,
    birthDate: entity.birthDate,
    occupation: entity.occupation,
  });
  const jsonLd = buildEntityProfileJsonLd({
    kind: entity.kind,
    seo: seoInput,
  });

  const openGraph: NonNullable<Metadata["openGraph"]> = {
    type: "profile",
    title,
    url: canonicalUrl,
    locale: "tr_TR",
  };
  if (description) {
    openGraph.description = description;
  }
  if (entity.portrait?.url) {
    openGraph.images = [
      {
        url: entity.portrait.url,
        width: entity.portrait.width ?? undefined,
        height: entity.portrait.height ?? undefined,
        alt: optionalText(entity.portrait.altText),
      },
    ];
  }

  const twitter: NonNullable<Metadata["twitter"]> = {
    card: entity.portrait?.url ? "summary_large_image" : "summary",
    title,
  };
  if (description) {
    twitter.description = description;
  }
  if (entity.portrait?.url) {
    twitter.images = [entity.portrait.url];
  }

  const metadata: Metadata = {
    title,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph,
    twitter,
  };
  if (description) {
    metadata.description = description;
  }

  return {
    metadata,
    jsonLd,
    jsonLdScript: serializeEntityProfileJsonLd(jsonLd),
  };
}
